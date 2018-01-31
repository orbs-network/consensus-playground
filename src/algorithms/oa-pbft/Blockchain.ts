import * as _ from "lodash";
import { Block, DecryptedBlock, EncryptedBlock, Cmap, Utils } from "./common";
import { Decryptor } from "./Decryptor";
import { Mempool } from "./Mempool";
import { NetworkInterface } from "./NetworkInterface";
import bind from "bind-decorator";

const GENESIS_CONTENT = 1234;

export class Blockchain {
  protected closedBlocks: Block[] = [];
  protected mempool: Mempool;
  protected netInterface: NetworkInterface;

  constructor() {


  }

  @bind
  init(numNodes: number): void {
    // set default genesis block
    this.closedBlocks.push(this.createGenesisBlock(numNodes));
  }

  @bind
  createGenesisBlock(numNodes: number): Block {
    const genesisEB: EncryptedBlock = { term: 0, content: GENESIS_CONTENT, hash: Utils.hashContent(GENESIS_CONTENT), lastEBlockHash: undefined, lastDBlockHash: undefined, creator: -1, cmap: new Cmap(numNodes) };
     const genesisDB: DecryptedBlock = Decryptor.Decrypt(genesisEB);
    const genesisBlock: Block = { term: 0, encryptedBlock: genesisEB, decryptedBlock: genesisDB, blockProof: undefined };
    return genesisBlock;
  }

  @bind
  getClosedBlocks(): Block[] {
    return this.closedBlocks;
  }

  @bind
  getLastBlock(): Block {
    return this.closedBlocks[(this.closedBlocks.length - 1)];
  }

  @bind
  addBlock(block: Block): void {
    this.closedBlocks.push(block);
  }



}
