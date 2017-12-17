import * as _ from "lodash";
import bind from "bind-decorator";

export interface Ballot {
  ballotNumber: number;
  nodeNumber: number;
}

export interface Block {
  blockNumber: number;
  content: number;
}

export interface Proposal {
  block: Block;
  ballot: Ballot;
}

export class Utils {
  protected numNodes: number;
  protected nodeNumber: number;

  constructor(numNodes: number, nodeNumber: number) {
    this.numNodes = numNodes;
    this.nodeNumber = nodeNumber;
  }

  @bind
  isBallotEqual(ballot1: Ballot, ballot2: Ballot): boolean {
    if (ballot1.ballotNumber != ballot2.ballotNumber) return false;
    return (ballot1.nodeNumber == ballot2.nodeNumber);
  }

  @bind
  isBallotGreaterEqual(ballot1: Ballot, ballot2: Ballot): boolean {
    if (ballot1.ballotNumber > ballot2.ballotNumber) return true;
    if (ballot1.ballotNumber < ballot2.ballotNumber) return false;
    return (ballot1.nodeNumber >= ballot2.nodeNumber);
  }

  @bind
  isMajority(num: number): boolean {
    return (num > Math.ceil(0.5 * this.numNodes));
  }

  @bind
  getMinimalSlot(pendingProposals: Proposal[]): number {
    let res = -1;
    for (const stringSlot in pendingProposals) {
      const slot: number = _.toInteger(stringSlot);
      if (res == -1 || slot < res) res = slot;
    }
    return res;
  }

}
