import BaseNode from "../../simulation/BaseNode";
import BaseEvent from "../../simulation/BaseEvent";
import MessageEvent from "../../simulation/events/MessageEvent";
import TimeoutEvent from "../../simulation/events/TimeoutEvent";
import NodeStartEvent from "../../simulation/events/NodeStartEvent";
import bind from "bind-decorator";

const BLOCK_TIMEOUT_MS = 1000;

interface Block {
  blockNumber: number;
  content: number;
  validators: number[];
}

interface Message {
  type: string;
  block?: Block;
  validator?: number;
}

export default class HonestNode extends BaseNode {
  protected nextBlockNumber = 0;
  protected closedBlocks: Block[] = [];
  protected pendingBlocks: Block[] = []; // only for leader

  @bind
  isLeader(): boolean {
    return this.nodeNumber === 1; // constant leader (first node)
  }

  @bind
  leaderStartNextBlock(): void {
    if (!this.isLeader()) return;
    const nextBlock: Block = { blockNumber: this.nextBlockNumber, content: this.scenario.randomizer.next(), validators: [] };
    this.log(`starting block ${nextBlock.blockNumber}`);
    this.pendingBlocks[this.nextBlockNumber] = nextBlock;
    this.setTimeout(BLOCK_TIMEOUT_MS, <Message>{ type: "BlockTimeout", block: nextBlock });
    this.broadcast(<Message>{ type: "PleaseValidate", block: nextBlock });
  }

  @bind
  nonLeaderValidateBlock(block: Block): void {
    if (this.isLeader()) return;
    this.broadcast(<Message>{ type: "Validation", block: block, validator: this.nodeNumber });
  }

  @bind
  leaderAddValidation(block: Block, validator: number): void {
    if (!this.isLeader()) return;
    if (this.pendingBlocks[block.blockNumber]) {
      this.pendingBlocks[block.blockNumber].validators.push(validator);
    }
  }

  @bind
  leaderBlockTimeout(block: Block): void {
    if (!this.isLeader()) return;
    if (this.pendingBlocks[block.blockNumber]) {
      const closedBlock = this.pendingBlocks[block.blockNumber];
      delete this.pendingBlocks[block.blockNumber];
      this.closedBlock(closedBlock);
      this.broadcast(<Message>{ type: "ClosedBlock", block: closedBlock });
      this.leaderStartNextBlock();
    }
  }

  @bind
  closedBlock(block: Block): void {
    this.closedBlocks[block.blockNumber] = block;
    this.nextBlockNumber = Math.max(block.blockNumber + 1, this.nextBlockNumber);
    this.log(`closed block ${block.blockNumber}, validators ${block.validators}`);
  }

  @bind
  onStart(event: NodeStartEvent): void {
    this.leaderStartNextBlock();
  }

  @bind
  onMessage(event: MessageEvent): void {
    const msg = <Message>event.message;
    switch (msg.type) {
      case "PleaseValidate": {
        this.nonLeaderValidateBlock(msg.block);
        break;
      }
      case "Validation": {
        this.leaderAddValidation(msg.block, msg.validator);
        break;
      }
      case "ClosedBlock": {
        this.closedBlock(msg.block);
        break;
      }
    }
  }

  @bind
  onTimeout(event: TimeoutEvent): void {
    const msg = <Message>event.message;
    switch (msg.type) {
      case "BlockTimeout": {
        this.leaderBlockTimeout(msg.block);
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
    return block1.content == block2.content;
  }

}
