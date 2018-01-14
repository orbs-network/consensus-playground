import * as _ from "lodash";
import bind from "bind-decorator";

const BYZ_MAJORITY = 2.0 / 3.0;


export interface Block {
  blockNumber: number;
  content: number;
}

export interface Proposal {
  block: Block;
  height: number;
  round: number;
  proposerID: number;
}

export interface Message {
  type: string;
  sender: number;
  round?: number;
  block?: Block;
  proposal?: Proposal;
}

export class Utils {
  protected numNodes: number;
  protected nodeNumber: number;

  constructor(numNodes: number, nodeNumber: number) {
    this.numNodes = numNodes;
    this.nodeNumber = nodeNumber;
  }


  @bind
  isBlockEqual(block1: Block, block2: Block): boolean {
    if (block1.blockNumber != block2.blockNumber) return false;
    return (block1.content == block2.content);
  }



  @bind
  isProposalEqual(proposal1: Proposal, proposal2: Proposal): boolean {
    if (!this.isBlockEqual(proposal1.block, proposal2.block)) return false;
    if (proposal1.height != proposal2.height) return false;
    if (proposal1.proposerID != proposal2.proposerID) return false;
    return (proposal1.round == proposal2.round);
  }


  @bind
  is50Majority(num: number): boolean {
    return (num > Math.ceil(0.5 * this.numNodes));
  }

  @bind
  isByzMaj(num: number): boolean {
    return (num >= Math.ceil(BYZ_MAJORITY * this.numNodes));
  }


}
