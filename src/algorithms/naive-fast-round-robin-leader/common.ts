import * as _ from "lodash";
import bind from "bind-decorator";

export interface Block {
  blockNumber: number;
  content: number;
  validators: number[]; // these symbolize signatures
  cancellors: number[];
  cancelled: boolean;
}

export class Utils {
  protected numNodes: number;
  protected nodeNumber: number;

  constructor(numNodes: number, nodeNumber: number) {
    this.numNodes = numNodes;
    this.nodeNumber = nodeNumber;
  }

  @bind
  getLeaderForBlock(blockNumber: number): number {
    return (blockNumber % this.numNodes) + 1;
  }

  @bind
  isLeader(blockNumber: number): boolean {
    return this.getLeaderForBlock(blockNumber) === this.nodeNumber;
  }

  @bind
  isBlockFromLeader(block: Block): boolean {
    const leader = this.getLeaderForBlock(block.blockNumber);
    return _.indexOf(block.validators, leader) !== -1;
  }

  @bind
  doesBlockHaveEnoughValidations(block: Block): boolean {
    const leader = this.getLeaderForBlock(block.blockNumber);
    const numValidatorsRequired = Math.ceil(this.numNodes * 0.67);
    if (!block.cancelled) {
      if (_.indexOf(block.validators, leader) === -1) return false; // leader must validate
      return _.uniq(block.validators).length >= numValidatorsRequired;
    } else {
      if (_.indexOf(block.cancellors, leader) !== -1) return true; // leader alone is enough to cancel
      return _.uniq(block.cancellors).length >= numValidatorsRequired;
    }
  }

  @bind
  addValidatorToBlock(block: Block, validator: number): void {
    if (_.indexOf(block.validators, validator) === -1) {
      block.validators.push(validator);
    }
  }

  @bind
  addCancellorToBlock(block: Block, validator: number): void {
    if (_.indexOf(block.cancellors, validator) === -1) {
      block.cancellors.push(validator);
    }
  }

}
