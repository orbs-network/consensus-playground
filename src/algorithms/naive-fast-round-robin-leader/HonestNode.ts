import * as _ from "lodash";
import { Utils, Block } from "./common";
import BaseNode from "../../simulation/BaseNode";
import BaseEvent from "../../simulation/BaseEvent";
import MessageEvent from "../../simulation/events/MessageEvent";
import TimeoutEvent from "../../simulation/events/TimeoutEvent";
import NodeStartEvent from "../../simulation/events/NodeStartEvent";
import bind from "bind-decorator";

const BLOCK_GRACE_TIME_MS = 1000;

interface Message {
  type: string;
  block?: Block;
  blockNumber?: number;
  validator?: number;
}

export default class HonestNode extends BaseNode {
  protected nextBlockNumber = 0;
  protected closedBlocks: Block[] = [];
  protected collectingValidationVotes: Block[] = [];
  protected collectingCancellationVotes: Block[] = [];
  protected utils: Utils;

  @bind
  startProcessForNextBlockNumber(): void {
    this.setTimeout(BLOCK_GRACE_TIME_MS, <Message>{ type: "BlockGrace", blockNumber: this.nextBlockNumber });
    if (this.utils.isLeader(this.nextBlockNumber)) {
      this.leaderProposeBlock(this.nextBlockNumber);
    }
  }

  @bind
  leaderProposeBlock(blockNumber: number): void {
    if (!this.utils.isLeader(blockNumber)) {
      this.error(`tried to propose a block that I'm not leader for`);
      return;
    }
    const proposedBlock: Block = {
      blockNumber: blockNumber,
      content: this.scenario.randomizer.next(), // random content synbolizing the transactions
      validators: [],
      cancellors: [],
      cancelled: false
    };
    this.log(`proposing block ${blockNumber}`);
    this.addValidationVote(proposedBlock, this.nodeNumber);
    this.broadcast(<Message>{ type: "ProposedBlock", block: proposedBlock });
  }

  @bind
  validatorReceivedProposedBlock(block: Block): void {
    if (this.utils.isLeader(block.blockNumber)) {
      this.error(`was asked to validate a block that I'm the leader for`);
      return;
    }
    if (!this.utils.isBlockFromLeader(block)) {
      this.error(`received proposed block that isn't validated by its leader`);
      return;
    }
    if (this.nextBlockNumber === block.blockNumber) {
      this.addValidationVote(block, this.nodeNumber);
      this.broadcast(<Message>{ type: "ValidationVote", block: block, validator: this.nodeNumber });
      return;
    }
    if (this.closedBlocks[block.blockNumber]) {
      this.broadcast(<Message>{ type: "ClosedBlock", block: this.closedBlocks[block.blockNumber] });
    } else {
      this.warn(`not in sync with proposed block, my next is ${this.nextBlockNumber} but block has ${block.blockNumber}`);
    }
  }

  @bind
  blockGracePassed(blockNumber: number): void {
    if (this.nextBlockNumber !== blockNumber) {
      return;
    }
    const cancelledBlock: Block = {
      blockNumber: blockNumber,
      content: 0,
      validators: [],
      cancellors: [],
      cancelled: true
    };
    this.addCancellationVote(cancelledBlock, this.nodeNumber);
    this.broadcast(<Message>{ type: "CancellationVote", block: cancelledBlock, validator: this.nodeNumber });
  }

  @bind
  addValidationVote(block: Block, validator: number): void {
    if (this.closedBlocks[block.blockNumber]) {
      this.broadcast(<Message>{ type: "ClosedBlock", block: this.closedBlocks[block.blockNumber] });
      return;
    }
    if (!this.collectingValidationVotes[block.blockNumber]) {
      this.collectingValidationVotes[block.blockNumber] = block;
    }
    const validatedBlock = this.collectingValidationVotes[block.blockNumber];
    if (validatedBlock.content !== block.content) {
      this.error(`got validation for block with incorrect content`);
      return;
    }
    this.utils.addValidatorToBlock(validatedBlock, validator);
    if (this.utils.doesBlockHaveEnoughValidations(validatedBlock)) {
      this.broadcast(<Message>{ type: "ClosedBlock", block: validatedBlock });
      this.processClosedBlock(validatedBlock);
    }
  }

  @bind
  addCancellationVote(block: Block, validator: number): void {
    if (this.closedBlocks[block.blockNumber]) {
      this.broadcast(<Message>{ type: "ClosedBlock", block: this.closedBlocks[block.blockNumber] });
      return;
    }
    if (!this.collectingCancellationVotes[block.blockNumber]) {
      this.collectingCancellationVotes[block.blockNumber] = block;
    }
    const cancelledBlock = this.collectingCancellationVotes[block.blockNumber];
    this.utils.addCancellorToBlock(cancelledBlock, validator);
    if (this.utils.doesBlockHaveEnoughValidations(cancelledBlock)) {
      this.broadcast(<Message>{ type: "ClosedBlock", block: cancelledBlock });
      this.processClosedBlock(cancelledBlock);
    }
  }

  @bind
  processClosedBlock(closedBlock: Block): void {
    delete this.collectingValidationVotes[closedBlock.blockNumber];
    delete this.collectingCancellationVotes[closedBlock.blockNumber];
    if (!this.utils.doesBlockHaveEnoughValidations(closedBlock)) {
      this.error(`trying to process closed block without enough validations`);
      return;
    }
    if (this.closedBlocks[closedBlock.blockNumber]) {
      const existingClosedBlock = this.closedBlocks[closedBlock.blockNumber];
      if (existingClosedBlock.content !== closedBlock.content) {
        this.error(`received a different valid closed block for a number that was already closed, we have a fork!`);
        this.log(` existing content ${existingClosedBlock.content}, validators ${existingClosedBlock.validators}, cancellors ${existingClosedBlock.cancellors}`);
        this.log(` new content ${closedBlock.content}, validators ${closedBlock.validators}, cancellors ${closedBlock.cancellors}`);
        return;
      }
      return;
    }
    this.closedBlocks[closedBlock.blockNumber] = closedBlock;
    if (!closedBlock.cancelled) {
      this.log(`closed block ${closedBlock.blockNumber}, validators ${closedBlock.validators}`);
    } else {
      this.log(`cancelled block ${closedBlock.blockNumber}, validators ${closedBlock.cancellors}`);
    }
    if (closedBlock.blockNumber + 1 > this.nextBlockNumber) {
      this.nextBlockNumber = closedBlock.blockNumber + 1;
      this.startProcessForNextBlockNumber();
    }
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
        this.addValidationVote(msg.block, msg.validator);
        break;
      }
      case "CancellationVote": {
        this.addCancellationVote(msg.block, msg.validator);
        break;
      }
      case "ClosedBlock": {
        this.processClosedBlock(msg.block);
        break;
      }
    }
  }

  @bind
  onTimeout(event: TimeoutEvent): void {
    const msg = <Message>event.message;
    switch (msg.type) {
      case "BlockGrace": {
        this.blockGracePassed(msg.blockNumber);
        break;
      }
    }
  }

  @bind
  benchmarkGetClosedBlocks(): Block[] {
    return this.closedBlocks;
  }

  @bind
  benchmarkAreClosedBlocksIdentical(block1: Block, block2: Block): boolean {
    return (block1.content == block2.content) && (block1.cancelled == block2.cancelled);
  }

}
