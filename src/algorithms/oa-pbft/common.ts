import * as _ from "lodash";
import bind from "bind-decorator";
import Random from "../../simulation/Random";
import BaseScenario from "../../simulation/BaseScenario";
import Logger from "../../simulation/Logger";

// export const N = 5; // number of nodes in the system
// export const M = (3 * F) + 1; // committee size
export const F = 1; // upper bound on number of Byzantine nodes TODO move to scenario

const BYZ_MAJORITY = 2.0 / 3.0;

const HASH_LENGTH = 8; // pseudo hash representing block hash


export enum ConsensusMessageType {
  PrePrepare,
  Prepare,
  Commit,
  Committed,
  ViewChange,
  NewView
}


export class Cmap {
  public order: number[];

  constructor(numNodes: number, seed: string= "seed", prevCmap: Cmap= undefined) {
    const randomizer = new Random(seed);
    const range = n => Array.from({length: n}, (value, key) => (key + 1) );
    this.order = randomizer.shuffle(range(numNodes));
  }


}

export interface BlockProof {
  term: number;
  hash: string;
  prepares: boolean[];
  commits: boolean[];
  committed: boolean;
}


export interface EncryptedBlock {
  term: number;
  content: number;
  hash: string;
  lastEBlockHash: string;
  lastDBlockHash: string;
  creator: number;
  cmap: Cmap;
}

export interface DecryptedBlock {
  term: number;
  content: number;
  hash: string;
  lastEBlockHash: string;
  cmap: Cmap;
}

export interface Block {
  term: number;
  encryptedBlock: EncryptedBlock;
  decryptedBlock: DecryptedBlock;
  blockProof: BlockProof;
  // TODO add shares
}

export interface Proposal {
  term: number;
  view: number;
  candidateEBlock: EncryptedBlock;
  prepMessages: Message[];
}

export interface Message {
  type: string;
  sender: number;
  term?: number;
  view?: number;
  block?: Block;
  eBlock?: EncryptedBlock;
  eBlockHash?: string;
  dBlock?: DecryptedBlock;
  conMsgType?: ConsensusMessageType;
  blockProof?: BlockProof;
  proposal?: Proposal;
  viewChangeMsgs?: Message[];
  newPrePrepMsg?: Message;
  blockShare?: BlockShare;

}

export interface BlockShare {
  blockHash: string;
  term: number;
  nodeNumber: number;
}

export class Utils {
  public scenario: BaseScenario;
  public numNodes: number; // n
  public committeeSize: number; // m
  public numByz: number; // f
  public nodeNumber: number;
  public k: number;
  public logger: Logger;

  constructor(scenario: BaseScenario, nodeNumber: number, logger: Logger) {
    this.scenario = scenario;
    this.numNodes = scenario.numNodes;
    this.committeeSize = this.numNodes; // TODO could also be in scenario
    this.numByz = F;
    this.nodeNumber = nodeNumber;
    this.logger = logger;
  }

  static hashContent(content: number): string {
    return content.toString(16).substring(2, 2 + HASH_LENGTH);
  }

  // returns true if A consists of a 2/3+ majority of B, false otherwise
  static isAByzMajOfB(a: number, b: number): boolean {
    return (a >= Math.ceil(BYZ_MAJORITY * b));
  }


  @bind
  isBlockEqual(block1: Block, block2: Block): boolean {
    if (block1.term != block2.term) return false;
    return (block1.decryptedBlock.content == block2.decryptedBlock.content);
  }



  @bind
  is50Majority(num: number): boolean {
    return (num > Math.ceil(0.5 * this.numNodes));
  }

  @bind
  isByzMaj(num: number): boolean {
    return Utils.isAByzMajOfB(num, this.numNodes);
  }

  @bind
  getCommittee(cmap: Cmap): number[] {
    return cmap.order.slice(0, this.committeeSize);
  }

  @bind
  getLeader(cmap: Cmap, view: number): number {
    return cmap.order[(view - 1) % this.committeeSize];
  }

  @bind
  isCommitteeMember(cmap: Cmap, nodeNumber: number): boolean {
    return ( (cmap.order.indexOf(nodeNumber) >= 0) && (cmap.order.indexOf(nodeNumber) < this.committeeSize) );
  }

  @bind
  isLeader(cmap: Cmap, nodeNumber: number, view: number): boolean {
    return ( this.getLeader(cmap, view) == nodeNumber );
  }


  @bind
  areCmapsEqual(cmap1: Cmap, cmap2: Cmap): boolean {
    return _.isEqual(cmap1.order, cmap2.order); // order matters as required
  }


}
