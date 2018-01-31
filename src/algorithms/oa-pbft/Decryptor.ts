import * as _ from "lodash";
import { Utils, Block, EncryptedBlock, DecryptedBlock } from "./common";
import { NetworkInterface } from "./NetworkInterface";
import { ConsensusEngine } from "./ConsensusEngine";
import { Blockchain } from "./Blockchain";
import bind from "bind-decorator";


export class Decryptor {
  protected blockchain: Blockchain;
  protected consensusEngine: ConsensusEngine;
  protected netInterface: NetworkInterface;

  protected committedEBtoDecrypt: EncryptedBlock;

  // TODO need to add k shares condition
  static Decrypt(eBlock: EncryptedBlock): DecryptedBlock {
    const dBlock: DecryptedBlock = { term: eBlock.term, content: eBlock.content, hash: Utils.hashContent(eBlock.content), lastEBlockHash: eBlock.lastEBlockHash, cmap: eBlock.cmap };
    return dBlock;
  }

  constructor() {

    this.committedEBtoDecrypt = undefined;
  }

  @bind
  init(consensusEngine: ConsensusEngine, netInterface: NetworkInterface, blockchain: Blockchain): void {
    this.consensusEngine = consensusEngine;
    this.netInterface = netInterface;
    this.blockchain = blockchain;
  }

  @bind
  enterDecryptStage(eBlock: EncryptedBlock): void {
    this.committedEBtoDecrypt = eBlock;
    // TODO logic to handle obtaining and generation of shares
    // should handle shares that arrive before EB
    this.consensusEngine.handleBlockDecrypted(Decryptor.Decrypt(eBlock), eBlock);

  }

}
