import * as _ from "lodash";
import { Map, Utils, Message, Block, EncryptedBlock, DecryptedBlock, BlockShare, CryptoMessageType } from "./common";
import { NetworkInterface } from "./NetworkInterface";
import { ConsensusEngine } from "./ConsensusEngine";
import { Blockchain } from "./Blockchain";
import bind from "bind-decorator";


enum ShareStatus {
  Valid,
  UnVerified,
  Invalid
}

/**
 * Supporting the handling of multiple blocks of different terms simultaneosly.
 * State per block:
 *  - encryptedBlock - the block of txs; includes -> term ~ Id
 *  - blockShares - threshold to decrypt
 * @export
 * @interface DecryptorBlockState
 */
export interface DecryptorBlockState {
  encryptedBlock: EncryptedBlock;
  blockShares: BlockShare[];
  decrypted: boolean;
}

// interface Map<T> {
//   [K: number]: T;
// }

export class Decryptor {
  protected blockchain: Blockchain;
  protected consensusEngine: ConsensusEngine;
  protected netInterface: NetworkInterface;
  protected utils: Utils;
  protected committedEBtoDecrypt: Map<DecryptorBlockState>;

  // protected committedEBtoDecrypt: EncryptedBlock;
  // protected blockShares: BlockShare[];


  constructor() {


  }


  @bind
  init(consensusEngine: ConsensusEngine, netInterface: NetworkInterface, blockchain: Blockchain, utils: Utils): void {
    this.consensusEngine = consensusEngine;
    this.netInterface = netInterface;
    this.blockchain = blockchain;
    this.utils = utils;
    this.committedEBtoDecrypt = {};
  }


  @bind
  decrypt(eBlock: EncryptedBlock): DecryptedBlock {
    const dbs: DecryptorBlockState = this.committedEBtoDecrypt[eBlock.term];
    if (dbs && dbs.encryptedBlock) {
      if (this.countShares(eBlock.term, ShareStatus.Valid) < this.utils.sharingThreshold) {
        this.utils.logger.error(`Don't have enough shares for decryption, need ${this.utils.sharingThreshold}, have ${this.countShares(eBlock.term, ShareStatus.Valid)} valid shares`);
        return undefined;
      }
      const dBlock: DecryptedBlock = { term: eBlock.term, content: eBlock.content, hash: Utils.hashContent(eBlock.content), lastEBlockHash: eBlock.lastEBlockHash, cmap: eBlock.cmap };
      return dBlock;
    }
    return undefined;
  }

  /**
   * Check if encryptedBlock of term is in Dycrptor's state or not.
   * @param {term}
   * @returns {boolean}
   */
  @bind
  hasEBBP(term: number): boolean {
    const dbs: DecryptorBlockState = this.committedEBtoDecrypt[term];
    if (dbs && dbs.encryptedBlock) return true;
    return false;
  }

  @bind
  inDecryptingPhase(term: number): boolean {
    const dbs: DecryptorBlockState = this.committedEBtoDecrypt[term];
    if (dbs && dbs.encryptedBlock && !dbs.decrypted) return true;
    return false;
  }

  @bind
  enterDecryptStage(eBlock: EncryptedBlock): void {
    if (this.hasEBBP(eBlock.term)) return;
    this.utils.logger.log(`Entering Decryption stage for block (${eBlock.term},${eBlock.hash})`);
    if (!this.committedEBtoDecrypt[eBlock.term]) {
      const dbs: DecryptorBlockState = {encryptedBlock: eBlock, blockShares: new Array(this.utils.numNodes).fill(undefined), decrypted: false};
      this.committedEBtoDecrypt[eBlock.term] = dbs;
    }
    else { // already received shares, without EB for this term
      this.committedEBtoDecrypt[eBlock.term].encryptedBlock = eBlock;
    }
    // try to generate own block share if needed
    this.generateShareBlock(eBlock.term);
  }


  @bind
  generateShareBlock(term: number): void {
    let shareMsg: Message = { sender: this.utils.nodeNumber, type: "CryptoMessage" + "/" + CryptoMessageType.BlockShare, cryptoMsgType: CryptoMessageType.BlockShare, term: term };
    const dbs: DecryptorBlockState = this.committedEBtoDecrypt[term];
    if (dbs && dbs.encryptedBlock) {
      this.utils.logger.log(`Generate Share Block (${term}) Status is ${this.getShareStatusString(term)}.`);
      const blockShares: BlockShare[] = dbs.blockShares;
      if (!blockShares[this.utils.nodeNumber - 1] && this.countPotentialShares(term) < this.utils.sharingThreshold ) {
        this.utils.logger.log(`Status is ${this.getShareStatusString(term)}. Generating block share for term ${term}`);
        const newShare = { blockHash: dbs.encryptedBlock.hash, term: term, nodeNumber: this.utils.nodeNumber };
        shareMsg = { sender: this.utils.nodeNumber, type: "CryptoMessage" + "/" + CryptoMessageType.BlockShare, cryptoMsgType: CryptoMessageType.BlockShare, blockShare: newShare, term: term };
      }
    }
    this.handleBlockShare(shareMsg);
  }


  @bind
  handleBlockShare(msg: Message): void {
    // if ((this.countShares(msg.term, ShareStatus.Valid) >= this.utils.sharingThreshold)) { // not else since generateShareBlock may have added to number of shares available
    //   this.finishDecryptionPhase(msg.term);
    // }
    const term: number = msg.term;
    const blockShare: BlockShare = msg.blockShare;
    if (this.checkShareStatus(blockShare) != ShareStatus.Invalid) {
      // const term: number = blockShare.term;
      // if (!this.committedEBtoDecrypt[term]) return;
      if (!this.committedEBtoDecrypt[term]) {
        const dbs: DecryptorBlockState = {encryptedBlock: undefined, blockShares: new Array(this.utils.numNodes).fill(undefined), decrypted: false};
        this.committedEBtoDecrypt[term] = dbs;
        // this.utils.logger.log("######Received BlockShare: " + blockShare.nodeNumber + " For term: " + term);
      }
      const numPotentialSharesPrior = this.countPotentialShares(term);
      this.committedEBtoDecrypt[term].blockShares[blockShare.nodeNumber - 1] = blockShare;
      const numPotentialSharesPost = this.countPotentialShares(term);
      this.utils.logger.log(`Received share of Node ${blockShare.nodeNumber} for block (${term},${blockShare.blockHash}, from ${msg.sender}, status is ${this.getShareStatusString(term)})`);

      if ((numPotentialSharesPost <= this.utils.sharingThreshold) && (numPotentialSharesPrior < numPotentialSharesPost)) { // forward only unseen shares - even unverified up until threshold, including
        msg.sender = this.utils.nodeNumber;
        this.netInterface.fastcast(msg); // TODO fastcast
      }

      if (!this.committedEBtoDecrypt[term].blockShares[this.utils.nodeNumber - 1] && numPotentialSharesPost < this.utils.sharingThreshold) { //  try to generate blockshare
        this.generateShareBlock(term);
      }
    }
    if ((this.countShares(term, ShareStatus.Valid) >= this.utils.sharingThreshold)) { // not else since generateShareBlock may have added to number of shares available
      this.finishDecryptionPhase(term);
    }

  }


  @bind
  finishDecryptionPhase(term: number): void {
    if (this.inDecryptingPhase(term)) {
      const dbs: DecryptorBlockState = this.committedEBtoDecrypt[term];
      const decryptedBlock: DecryptedBlock = this.decrypt(dbs.encryptedBlock);
      this.committedEBtoDecrypt[term].decrypted = true;
      this.utils.logger.log(`Status is ${this.getShareStatusString(term)}, decrypting block!`);
      this.consensusEngine.handleBlockDecrypted(decryptedBlock, dbs.encryptedBlock, dbs.blockShares);
    }
    // else {
    //   this.utils.logger.log(`Status is ${this.getShareStatusString(term)}, missing EB- trying to obtain it.`);
    //   // TODO shouldn't happen, but in this case we need to sync to obtain EB
    // }
  }






  @bind
  checkShareStatus(shareBlock: BlockShare): ShareStatus {
    if (!shareBlock) return ShareStatus.Invalid;
    const dbs: DecryptorBlockState = this.committedEBtoDecrypt[shareBlock.term];
    if (dbs && dbs.encryptedBlock) {
        if (dbs.encryptedBlock.hash != shareBlock.blockHash) {
          this.utils.logger.debug(`Received invalid block share for block ${shareBlock.blockHash}, my EB is ${dbs.encryptedBlock.hash }`);
          return ShareStatus.Invalid;
        }
        else {
          return ShareStatus.Valid;
        }
    }
    this.utils.logger.debug(`Received block share for block ${shareBlock.blockHash}, don't have EB. Storing it for now... `);
    return ShareStatus.UnVerified;
  }

  @bind
  countShares(term: number, shareStatus: ShareStatus): number {
    let count = 0;
    const dbs: DecryptorBlockState = this.committedEBtoDecrypt[term];
    if (dbs) {
      const blockShares: BlockShare[] = dbs.blockShares;
      blockShares.forEach(item => count += (this.checkShareStatus(item) == shareStatus) ? 1 : 0);
    }
    return count;
  }

  @bind
  countPotentialShares(term: number): number {
    return (this.countShares(term, ShareStatus.UnVerified) + this.countShares(term, ShareStatus.Valid));
  }


  @bind
  getShareStatusString(term: number): string {
    const status = `valid/unverified/needed ${this.countShares(term, ShareStatus.Valid)}/${this.countShares(term, ShareStatus.UnVerified)}/${this.utils.sharingThreshold}`;
    return status;
  }

}
