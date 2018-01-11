import * as _ from "lodash";
import bind from "bind-decorator";

const BYZ_MAJORITY = 2.0 / 3.0;


export interface Block {
  blockNumber: number;
  content: number;
}

export interface Proposal {
  proposalID: number; // assuming this is a kind of hash, to make comparisons simpler
  block: Block;
  height: number;
  round: number;
  proposerID: number;
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
  createNilBlock(): Block {
    const res: Block = {
      blockNumber: -1,
      content: -1
    };
    return res;
  }

  @bind
  isNilProposal(proposal: Proposal): boolean {
    return (proposal.proposalID == -1);
  }



  @bind
  isProposalEqual(proposal1: Proposal, proposal2: Proposal): boolean {
    if (!this.isBlockEqual(proposal1.block, proposal2.block)) return false;
    if (proposal1.height != proposal2.height) return false;
    if (proposal1.proposerID != proposal2.proposerID) return false;
    return (proposal1.round == proposal2.round);
  }


  @bind
  isMajority(num: number): boolean {
    return (num > Math.ceil(0.5 * this.numNodes));
  }

  @bind
  isPolka(num: number): boolean {
    return (num >= Math.ceil(BYZ_MAJORITY * this.numNodes));
  }

  @bind
  countProposal(targetProposal: Proposal, proposalArray: Proposal[]): number {
    let res = 0;
    for (const entry of proposalArray) {
      if (this.isProposalEqual(entry, targetProposal)) {
        res += 1;
      }
    }
    return res;
  }

  @bind
  count(target: number, array: number[]): number {
    let res = 0;
    for (const entry of array) {
      if (entry == target) {
        res += 1;
      }
    }
    return res;
  }

  @bind
  getPolkaProposal(proposalArray: Proposal[]): Proposal {
    const idList: number[] = [];
    const idMap: Map<number, Proposal> = new Map<number, Proposal>();
    if (!proposalArray) return undefined;
    for (const entry of proposalArray) {
      if (entry) {
        idList.push(entry.proposalID);
        if (!idMap.has(entry.proposalID)) idMap[entry.proposalID] = entry;
      }
    }
    const uniqueIds = new Set(idList);
    for (const id of uniqueIds) {
      const voteCount: number = this.count(id, idList);
      // console.log(`vote count for ${id} is ${voteCount}`);
      if (this.isPolka(voteCount)) {
        return idMap[id];
      }
    }
    return undefined;
  }

  @bind
  printProposals(proposalArray: Proposal[]): void {
    const proposals: number[] = [];
    for (const i in proposalArray) {
      if (proposalArray[i]) {
        proposals[i] = proposalArray[i].proposalID;
      }
    }
    console.log(proposals);
  }
}
