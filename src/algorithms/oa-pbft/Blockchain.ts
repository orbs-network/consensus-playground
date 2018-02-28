import * as _ from "lodash";
import { Block, DecryptedBlock, EncryptedBlock, Cmap, Utils } from "./common";
import { Mempool } from "./Mempool";
import { NetworkInterface } from "./NetworkInterface";
import bind from "bind-decorator";

const GENESIS_CONTENT = 1234;
const GENESIS_TERM = 0;

interface Map<T> {
  [K: number]: T;
}

export class Blockchain {
  // protected closedBlocks: Block[] = [];
  protected closedBlocks: Map<Block>;
  protected mempool: Mempool;
  protected netInterface: NetworkInterface;

  constructor() {
    this.closedBlocks = {};

  }

  @bind
  init(numNodes: number): void {
    // set default genesis block
    // this.closedBlocks.push(this.createGenesisBlock(numNodes));
    this.closedBlocks[GENESIS_TERM] = this.createGenesisBlock(numNodes);
  }

  @bind
  createGenesisBlock(numNodes: number): Block {
    // dummy entries for genesis block
    const genesisEB: EncryptedBlock = { term: 0, view: 1, content: GENESIS_CONTENT, hash: Utils.hashContent(GENESIS_CONTENT), lastEBlockHash: undefined, lastDBlockHash: undefined, creator: -1, cmap: new Cmap(numNodes) };
    const genesisDB: DecryptedBlock = { term: 0, content: GENESIS_CONTENT, hash: Utils.hashContent(GENESIS_CONTENT), lastEBlockHash: undefined, cmap: new Cmap(numNodes) };
    const genesisBlock: Block = { term: 0, encryptedBlock: genesisEB, decryptedBlock: genesisDB, blockProof: undefined, blockShares: undefined };
    return genesisBlock;
  }

  @bind
  getClosedBlocks(): Block[] {
    const closedBlocks = Object.keys(this.closedBlocks).map(key => this.closedBlocks[key]);
    return closedBlocks;
  }

  @bind
  getBlocksRange(start: number, end?: number): Block[] {
    const blocks = [];
    const e = end ? end : this.getLastBlock().term;
    for (let i = start; i < e + 1; i++) {
      if (this.closedBlocks[i]) {
        blocks.push(this.closedBlocks[i]);
      }
    }
    return blocks;
  }

  @bind
  getLastBlock(): Block {
    return this.getClosedBlocks()[(this.getClosedBlocks().length - 1)];
  }

  @bind
  addBlock(block: Block): void {
    // this.closedBlocks.push(block);
    this.closedBlocks[block.term] = block;
  }



}
