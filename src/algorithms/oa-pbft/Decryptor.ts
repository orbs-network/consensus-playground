import * as _ from "lodash";
import { Utils, Message, Block, EncryptedBlock, DecryptedBlock, BlockShare, CryptoMessageType } from "./common";
import { NetworkInterface } from "./NetworkInterface";
import { ConsensusEngine } from "./ConsensusEngine";
import { Blockchain } from "./Blockchain";
import bind from "bind-decorator";


enum ShareStatus {
  Valid,
  UnVerified,
  Invalid
}

export class Decryptor {
  protected blockchain: Blockchain;
  protected consensusEngine: ConsensusEngine;
  protected netInterface: NetworkInterface;
  protected utils: Utils;

  protected committedEBtoDecrypt: EncryptedBlock;
  protected blockShares: BlockShare[];




  constructor() {


  }

  @bind
  reset(): void {
    this.utils.logger.debug(`Resetting Decryptor state...`);
    this.committedEBtoDecrypt = undefined;
    this.blockShares = new Array(this.utils.numNodes).fill(undefined);

  }

  @bind
  init(consensusEngine: ConsensusEngine, netInterface: NetworkInterface, blockchain: Blockchain, utils: Utils): void {
    this.consensusEngine = consensusEngine;
    this.netInterface = netInterface;
    this.blockchain = blockchain;
    this.utils = utils;
    this.reset();

  }

  @bind
  decrypt(eBlock: EncryptedBlock, blockShares: BlockShare[]): DecryptedBlock {
    if (this.countShares(blockShares, ShareStatus.Valid) < this.utils.sharingThreshold) {
      this.utils.logger.error(`Don't have enough shares for decryption, need ${this.utils.sharingThreshold}, have ${this.countShares(blockShares, ShareStatus.Valid)} valid shares`);
      return undefined;
    }
    const dBlock: DecryptedBlock = { term: eBlock.term, content: eBlock.content, hash: Utils.hashContent(eBlock.content), lastEBlockHash: eBlock.lastEBlockHash, cmap: eBlock.cmap };
    return dBlock;
  }

  @bind
  inDecryptingPhase(): boolean {
    return this.committedEBtoDecrypt ? true : false;
  }

  @bind
  enterDecryptStage(eBlock: EncryptedBlock): void {
    if (this.inDecryptingPhase()) return;
    this.utils.logger.log(`Entering Decryption stage for block (${eBlock.term},${eBlock.hash})`);
    this.committedEBtoDecrypt = eBlock;
    // try to generate own block share if needed
    const newShare: BlockShare = this.generateShareBlock(this.committedEBtoDecrypt);
    if (newShare) {
      this.handleBlockShare(newShare);
    }
    else {
      if (this.countShares(this.blockShares, ShareStatus.Valid) >= this.utils.sharingThreshold) {
        this.finishDecryptionPhase();
      }
    }

  }

  @bind
  finishDecryptionPhase(): void {
    if (this.committedEBtoDecrypt) {
      this.utils.logger.log(`Status is ${this.getShareStatusString()}, decrypting block!`);
      this.consensusEngine.handleBlockDecrypted(this.decrypt(this.committedEBtoDecrypt, this.blockShares), this.committedEBtoDecrypt, this.blockShares);
      this.reset(); // finished work on this EB
    }
    else {
      this.utils.logger.log(`Status is ${this.getShareStatusString()}, missing EB- trying to obtain it.`);
      // TODO shouldn't happen, but in this case we need to sync to obtain EB
    }
  }


  @bind
  handleBlockShare(blockShare: BlockShare): void {
    if (this.checkShareStatus(blockShare) == ShareStatus.Invalid) {
      return;
    }

    this.blockShares[blockShare.nodeNumber - 1] = blockShare;

    this.utils.logger.log(`Received share from ${blockShare.nodeNumber} for block (${blockShare.term},${blockShare.blockHash}, status is ${this.getShareStatusString()})`);
    if ( this.countPotentialShares(this.blockShares) < this.utils.sharingThreshold ) {
      this.generateShareBlock(this.committedEBtoDecrypt);
    }

    if ( (this.countShares(this.blockShares, ShareStatus.Valid) >= this.utils.sharingThreshold)) { // not else since generateShareBlock may have added to number of shares available
      this.finishDecryptionPhase();
    }

  }

  @bind
  generateShareBlock(eBlock: EncryptedBlock): BlockShare {
    let newShare: BlockShare = undefined;
    if (eBlock && this.consensusEngine.getTerm() != eBlock.term ) {
      this.utils.logger.debug(`Can't generate share for block ${eBlock.term}, at term ${this.consensusEngine.getTerm()}`);
      return undefined;
    }
    if (eBlock && !this.blockShares[this.utils.nodeNumber - 1] && this.countPotentialShares(this.blockShares) < this.utils.sharingThreshold ) {
      this.utils.logger.log(`Status is ${this.getShareStatusString()}. Generating block share`);
      newShare = { blockHash: eBlock.hash, term: eBlock.term, nodeNumber: this.utils.nodeNumber };
      this.blockShares[this.utils.nodeNumber - 1] = newShare;
      const shareMsg: Message = { sender: this.utils.nodeNumber, term: eBlock.term, type: "CryptoMessage" + "/" + CryptoMessageType.BlockShare, cryptoMsgType: CryptoMessageType.BlockShare, blockShare: newShare };
      this.netInterface.broadcast(shareMsg); // TODO fast forwarding scheme
    }

    return newShare;
  }

  @bind
  checkShareStatus(shareBlock: BlockShare): ShareStatus {
    if (!shareBlock) return ShareStatus.Invalid;
    if (this.consensusEngine.getTerm() != shareBlock.term) {
      this.utils.logger.debug(`Received block share for term ${shareBlock.term}, at term ${this.consensusEngine.getTerm()}`);
      return ShareStatus.Invalid;
    }
    if (this.committedEBtoDecrypt ) {
      if (this.committedEBtoDecrypt.hash != shareBlock.blockHash) {
        this.utils.logger.debug(`Received invalid block share for block ${shareBlock.blockHash}, my EB is ${this.committedEBtoDecrypt.hash }`);
        return ShareStatus.Invalid;
      }
      else {
        return ShareStatus.Valid;
      }

    }
    else {
      this.utils.logger.debug(`Received block share for block ${shareBlock.blockHash}, don't have EB. Storing it for now... `);
      return ShareStatus.UnVerified;
    }

  }

  @bind
  countShares(shareBlocks: BlockShare[], shareStatus: ShareStatus): number {
    let count = 0;
    shareBlocks.forEach(item => count += (this.checkShareStatus(item) == shareStatus) ? 1 : 0);
    return count;
  }

  @bind
  countPotentialShares(shareBlocks: BlockShare[]): number {
    return (this.countShares(shareBlocks, ShareStatus.UnVerified) + this.countShares(shareBlocks, ShareStatus.Valid));
  }

  @bind
  getShareStatusString(): string {
    const status = `valid/unverified/needed ${this.countShares(this.blockShares, ShareStatus.Valid)}/${this.countShares(this.blockShares, ShareStatus.UnVerified)}/${this.utils.sharingThreshold}`;
    return status;
  }


}
