import * as _ from "lodash";
import bind from "bind-decorator";
import Random from "../../simulation/Random";
import OrbsScenario from "../../scenarios/oa-pbft/OrbsScenario";
import Logger from "../../simulation/Logger";

// export const N = 5; // number of nodes in the system
// export const M = (3 * F) + 1; // committee size
export const F = 1; // upper bound on number of Byzantine nodes. Moved to OrbsScenario, this is just a dummy default

const BYZ_MAJORITY = 2.0 / 3.0;

const HASH_LENGTH = 8; // pseudo hash representing block hash
export const BASE_MSG_SIZE_BYTES = 1000;

export class MapWithDefault {
  protected defaultValue: number;
  public sMap: StrMap<number>;

  constructor(dValue: number) {
    this.defaultValue = dValue;
    this.sMap = {};
  }

  @bind
  get(key: string): number {
    if (!this.sMap[key]) return this.defaultValue;
    else return this.sMap[key];
  }

  @bind
  set(key: string, value: number): void {
    this.sMap[key] = value;
  }
}

export interface Map<T> {
  [K: number]: T;
}

export interface StrMap<T> {
  [K: string]: T;
}

export enum ConsensusMessageType {
  PrePrepare = "PrePrepare",
  Prepare = "Prepare",
  Commit = "Commit",
  Committed = "Committed",
  ViewChange = "ViewChange",
  NewView = "NewView"
}

export enum CryptoMessageType {
  BlockShare = "BlockShare"
}

export enum SyncerMessageType {
  RequestSync = "RequestSync",
  SyncPeer = "SyncPeer"
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
  view: number;
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
  blockShares: BlockShare[];
}

export interface Proposal {
  term: number;
  view: number;
  candidateEBlock: EncryptedBlock;
  prepMessages: Message[];
}

export interface Message {
  type: string;
  size_bytes?: number;
  sender: number;
  receipient?: number;
  term: number;
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
  cryptoMsgType?: CryptoMessageType;
  syncerMsgType?: SyncerMessageType;
  blockShare?: BlockShare;
  blocks?: Block[];

}

export interface BlockShare {
  blockHash: string;
  term: number;
  nodeNumber: number;
}

export class Utils {
  public scenario: OrbsScenario;
  public numNodes: number; // n
  public committeeSize: number; // m
  public numByz: number; // f
  public nodeNumber: number;
  public sharingThreshold: number;
  public logger: Logger;
  public sleeping = false;

  // number of nodes, committee size and number of Byzantine nodes are handled by
  // the Node since the number of nodes is only determined after the scenario generates them.
  constructor(scenario: OrbsScenario, nodeNumber: number, logger: Logger) {
    this.scenario = scenario;
    this.nodeNumber = nodeNumber;
    this.logger = logger;
    this.sleeping = false;
    this.numByz = scenario.numByz; // TODO duplicate - only need scenario!!
    this.committeeSize = scenario.committeeSize;
    this.numNodes = scenario.numNodes;
  }

  static getMessageTopType(str: string): string {
    const i = str.indexOf("/");
    if (i > -1) return str.slice(0, i);
    else return str;
  }

  static hashContent(content: number): string {
    return content.toString(16).substring(2, 2 + HASH_LENGTH);
  }

  // returns true if A consists of a 2/3+ majority of B, false otherwise
  static isAByzMajOfB(a: number, b: number): boolean {
    return (a >= Math.ceil(BYZ_MAJORITY * b));
  }

  // returns true if a >= (2 * f + 1)
  static isAByzMajWrtF(a: number, f: number): boolean {
    return (a >= (2 * f) + 1);
  }


  static areMessagesEqual(msg1: Message, msg2: Message): boolean {
    return (JSON.stringify(msg1) == JSON.stringify(msg2));
  }

  static areCmapsEqual(cmap1: Cmap, cmap2: Cmap): boolean {
    return _.isEqual(cmap1.order, cmap2.order); // order matters as required
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
    return Utils.isAByzMajWrtF(num, this.numByz);
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





}
