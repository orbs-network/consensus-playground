import * as _ from "lodash";
import { Utils, Message, Block, EncryptedBlock, DecryptedBlock, BlockShare, CryptoMessageType } from "./common";
import { NetworkInterface } from "./NetworkInterface";
import { ConsensusEngine } from "./ConsensusEngine";
import { Blockchain } from "./Blockchain";
import bind from "bind-decorator";


export class Decryptor {
  protected blockchain: Blockchain;
  protected consensusEngine: ConsensusEngine;
  protected netInterface: NetworkInterface;
  protected utils: Utils;

  protected committedEBtoDecrypt: EncryptedBlock;
  protected blockShares: BlockShare[];


  // TODO need to add k shares condition
  static Decrypt(eBlock: EncryptedBlock): DecryptedBlock {
    const dBlock: DecryptedBlock = { term: eBlock.term, content: eBlock.content, hash: Utils.hashContent(eBlock.content), lastEBlockHash: eBlock.lastEBlockHash, cmap: eBlock.cmap };
    return dBlock;
  }

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
      if (this.countValidShares(this.blockShares) >= this.utils.k) {
        this.finishDecryptionPhase();
      }
    }

  }

  @bind
  finishDecryptionPhase(): void {
    if (this.committedEBtoDecrypt) {
      this.utils.logger.log(`Have ${this.countValidShares(this.blockShares)}/${this.utils.k} shares, decrypting block!`);
      this.consensusEngine.handleBlockDecrypted(Decryptor.Decrypt(this.committedEBtoDecrypt), this.committedEBtoDecrypt);
      this.reset(); // finished work on this EB
    }
    else {
      this.utils.logger.log(`Have ${this.countValidShares(this.blockShares)}, missing EB- trying to obtain it.`);
      // TODO shouldn't happen, but in this case we need to sync to obtain EB
    }
  }


  @bind
  handleBlockShare(blockShare: BlockShare): void {
    if (!this.isValidShare(blockShare)) {
      return;
    }

    this.blockShares[blockShare.nodeNumber - 1] = blockShare;
    this.utils.logger.log(`Received share ${this.countValidShares(this.blockShares)}/${this.utils.k} from ${blockShare.nodeNumber} for block (${blockShare.term},${blockShare.blockHash})`);
    if ( this.countValidShares(this.blockShares) < this.utils.k ) {
      this.generateShareBlock(this.committedEBtoDecrypt);
    }

    if (this.countValidShares(this.blockShares) >= this.utils.k) { // not else since generateShareBlock may have added to number of shares available
      // TODO logic to handle obtaining and generation of shares
      // should handle shares that arrive before EB
      this.finishDecryptionPhase();
    }

  }

  @bind
  generateShareBlock(eBlock: EncryptedBlock): BlockShare {
    let newShare: BlockShare = undefined;
    if (eBlock && !this.blockShares[this.utils.nodeNumber - 1] && this.countValidShares(this.blockShares) < this.utils.k ) {
      this.utils.logger.log(`Have ${this.countValidShares(this.blockShares)}/${this.utils.k} shares, generating block share...`);
      newShare = { blockHash: eBlock.hash, term: this.consensusEngine.getTerm(), nodeNumber: this.utils.nodeNumber };
      this.blockShares[this.utils.nodeNumber - 1] = newShare;
      const shareMsg: Message = { sender: this.utils.nodeNumber, type: "CryptoMessage" + "/" + CryptoMessageType.BlockShare, cryptoMsgType: CryptoMessageType.BlockShare, blockShare: newShare };
      this.netInterface.broadcast(shareMsg); // TODO fast forwarding scheme
    }

    return newShare;
  }

  @bind
  isValidShare(shareBlock: BlockShare): boolean {
    if (!shareBlock) return false;
    if (this.consensusEngine.getTerm() != shareBlock.term) {
      this.utils.logger.debug(`Received block share for term ${shareBlock.term}, at term ${this.consensusEngine.getTerm()}`);
      return false;
    }
    if (!this.committedEBtoDecrypt || this.committedEBtoDecrypt.hash != shareBlock.blockHash) {
      this.utils.logger.debug(`Received block share for block ${shareBlock.blockHash}, my EB is ${this.committedEBtoDecrypt ? this.committedEBtoDecrypt.hash : "undefined" }`);
    }
    return true;
  }

  @bind
  countValidShares(shareBlocks: BlockShare[]): number {
    let count = 0;
    shareBlocks.forEach(item => count += (this.isValidShare(item)) ? 1 : 0);
    return count;
  }


}
