import * as _ from "lodash";
import { Utils, Block } from "./common";
import BaseNode from "../../simulation/BaseNode";
import BaseEvent from "../../simulation/BaseEvent";
import MessageEvent from "../../simulation/events/MessageEvent";
import TimeoutEvent from "../../simulation/events/TimeoutEvent";
import NodeStartEvent from "../../simulation/events/NodeStartEvent";
import bind from "bind-decorator";

const BLOCK_TIME_MS = 1000;
const BLOCK_GRACE_TIME_MS = 2000;

interface Message {
  type: string;
  block?: Block;
  blockNumber?: number;
  validator?: number;
}

export default class HonestNode extends BaseNode {
  protected nextBlockNumber = 0;
  protected closedBlocks: Block[] = [];
  protected collectingValidationVotes: Block; // only for the block's leader
  protected collectingCancellationVotes: Block[] = [];
  protected utils: Utils;

  @bind
  leaderProposeBlock(blockNumber: number): void {
    if (!this.utils.isLeader(this.nextBlockNumber)) {
      this.log(`ERROR: tried to propose a block that I'm not leader for`);
      return;
    }
    const proposedBlock: Block = {
      blockNumber: this.nextBlockNumber,
      content: this.scenario.randomizer.next(), // random content synbolizing the transactions
      validators: [this.nodeNumber],
      cancellors: [],
      cancelled: false
    };
    this.log(`proposing block ${blockNumber}`);
    this.collectingValidationVotes = proposedBlock;
    this.setTimeout(BLOCK_TIME_MS, <Message>{ type: "BlockTime", blockNumber: proposedBlock.blockNumber });
    this.broadcast(<Message>{ type: "ProposedBlock", block: proposedBlock });
  }

  @bind
  leaderAddValidationVote(block: Block, validator: number): void {
    if (!this.utils.isLeader(block.blockNumber)) {
      return;
    }
    if (this.nextBlockNumber !== block.blockNumber ||
        !this.collectingValidationVotes ||
        this.collectingValidationVotes.blockNumber != block.blockNumber) {
      this.log(`WARNING: got validation for a block I'm leader for but that is not the current one in progress`);
      return;
    }
    if (this.collectingValidationVotes.content != block.content) {
      this.log(`ERROR: got validation for block with incorrect content`);
      return;
    }
    this.utils.addValidatorToBlock(this.collectingValidationVotes, validator);
  }

  @bind
  leaderBlockTimePassed(blockNumber: number): void {
    if (!this.utils.isLeader(blockNumber)) {
      this.log(`ERROR: got timeout for a block that I'm not leader for`);
      return;
    }
    if (this.nextBlockNumber !== blockNumber ||
        !this.collectingValidationVotes ||
        this.collectingValidationVotes.blockNumber != blockNumber) {
      this.log(`WARNING: got timeout for a block that is not the current one in progress`);
      return;
    }
    if (this.utils.doesBlockHaveEnoughValidations(this.collectingValidationVotes)) {
      const closedBlock = this.collectingValidationVotes;
      this.collectingValidationVotes = undefined;
      this.broadcast(<Message>{ type: "ClosedBlock", block: closedBlock });
      this.processClosedBlock(closedBlock);
    } else {
      this.addCancellationVote(blockNumber, this.nodeNumber);
    }
  }

  @bind
  processClosedBlock(closedBlock: Block): void {
    if (!this.utils.isActiveBlockFromLeader(closedBlock)) {
      this.log(`ERROR: received closed block that isn't validated by its leader`);
      return;
    }
    if (!this.utils.doesBlockHaveEnoughValidations(closedBlock)) {
      this.log(`ERROR: trying to process closed block without enough validations`);
      return;
    }
    if (this.closedBlocks[closedBlock.blockNumber]) {
      if (this.closedBlocks[closedBlock.blockNumber].content != closedBlock.content) {
        this.log(`ERROR: received a different valid closed block for a number that was already closed, we have a fork!`);
        return;
      }
      return;
    }
    this.closedBlocks[closedBlock.blockNumber] = closedBlock;
    this.log(`closed block ${closedBlock.blockNumber}, validators ${closedBlock.validators}`);
    if (closedBlock.blockNumber + 1 > this.nextBlockNumber) {
      this.nextBlockNumber = closedBlock.blockNumber + 1;
      this.startProcessForNextBlockNumber();
    }
  }

  @bind
  processCancelledBlock(cancelledBlock: Block): void {
    if (!this.utils.doesBlockHaveEnoughCancellations(cancelledBlock)) {
      this.log(`ERROR: trying to process cancelled block without enough cancellations`);
      return;
    }
    if (this.closedBlocks[cancelledBlock.blockNumber]) {
      if (this.closedBlocks[cancelledBlock.blockNumber].cancelled != cancelledBlock.cancelled) {
        this.log(`ERROR: received a cancelled block for a number that was already closed, we have a fork!`);
        return;
      }
      return;
    }
    this.closedBlocks[cancelledBlock.blockNumber] = cancelledBlock;
    this.log(`cancelled block ${cancelledBlock.blockNumber}, validators ${cancelledBlock.cancellors}`);
    if (cancelledBlock.blockNumber + 1 > this.nextBlockNumber) {
      this.nextBlockNumber = cancelledBlock.blockNumber + 1;
      this.startProcessForNextBlockNumber();
    }
  }

  @bind
  startProcessForNextBlockNumber(): void {
    if (this.utils.isLeader(this.nextBlockNumber)) {
      this.leaderProposeBlock(this.nextBlockNumber);
    } else {
      this.setTimeout(BLOCK_GRACE_TIME_MS, <Message>{ type: "BlockGrace", blockNumber: this.nextBlockNumber });
    }
  }

  @bind
  validatorReceivedProposedBlock(block: Block): void {
    if (this.utils.isLeader(this.nextBlockNumber)) {
      this.log(`ERROR: was asked to validate a block that I'm the leader for`);
      return;
    }
    if (!this.utils.isActiveBlockFromLeader(block)) {
      this.log(`ERROR: received proposed block that isn't validated by its leader`);
      return;
    }
    if (this.nextBlockNumber === block.blockNumber) {
      this.broadcast(<Message>{ type: "ValidationVote", block: block, validator: this.nodeNumber });
      return;
    }
    if (this.closedBlocks[block.blockNumber]) {
      this.broadcast(<Message>{ type: "ClosedBlock", block: this.closedBlocks[block.blockNumber] });
    } else {
      this.log(`WARNING: not in sync with proposed block, my next is ${this.nextBlockNumber} but block has ${block.blockNumber}`);
    }
  }

  @bind
  addCancellationVote(blockNumber: number, validator: number): void {
    if (!this.collectingCancellationVotes[blockNumber]) {
      const cancelledBlock: Block = {
        blockNumber: blockNumber,
        content: 0,
        validators: [],
        cancellors: [],
        cancelled: true
      };
      this.collectingCancellationVotes[blockNumber] = cancelledBlock;
    }
    const cancelledBlock = this.collectingCancellationVotes[blockNumber];
    this.utils.addCancellorToBlock(cancelledBlock, validator);
    if (this.utils.doesBlockHaveEnoughCancellations(cancelledBlock)) {
      this.broadcast(<Message>{ type: "CancelledBlock", block: cancelledBlock });
      this.processCancelledBlock(cancelledBlock);
    }
  }

  @bind
  blockGracePassed(blockNumber: number): void {
    if (this.utils.isLeader(blockNumber)) {
      this.log(`ERROR: block grace passed for a block that I'm the leader for`);
      return;
    }
    if (this.nextBlockNumber !== blockNumber) {
      return;
    }
    this.addCancellationVote(blockNumber, this.nodeNumber);
    this.broadcast(<Message>{ type: "CancellationVote", blockNumber: blockNumber, validator: this.nodeNumber });
  }

  @bind
  onStart(event: NodeStartEvent): void {
    this.utils = new Utils(this.scenario.numNodes, this.nodeNumber);
    this.startProcessForNextBlockNumber();
  }

  @bind
  onMessage(event: MessageEvent): void {
    const msg = <Message>event.message;
    switch (msg.type) {
      case "ProposedBlock": {
        this.validatorReceivedProposedBlock(msg.block);
        break;
      }
      case "ValidationVote": {
        this.leaderAddValidationVote(msg.block, msg.validator);
        break;
      }
      case "CancellationVote": {
        this.addCancellationVote(msg.blockNumber, msg.validator);
        break;
      }
      case "ClosedBlock": {
        this.processClosedBlock(msg.block);
        break;
      }
      case "CancelledBlock": {
        this.processCancelledBlock(msg.block);
        break;
      }
    }
  }

  @bind
  onTimeout(event: TimeoutEvent): void {
    const msg = <Message>event.message;
    switch (msg.type) {
      case "BlockTime": {
        this.leaderBlockTimePassed(msg.blockNumber);
        break;
      }
      case "BlockGrace": {
        this.blockGracePassed(msg.blockNumber);
        break;
      }
    }
  }

}
