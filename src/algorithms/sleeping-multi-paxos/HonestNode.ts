import * as _ from "lodash";
import { Utils, Ballot, Block, Proposal } from "./common";
import BaseNode from "../../simulation/BaseNode";
import BaseEvent from "../../simulation/BaseEvent";
import MessageEvent from "../../simulation/events/MessageEvent";
import TimeoutEvent from "../../simulation/events/TimeoutEvent";
import NodeStartEvent from "../../simulation/events/NodeStartEvent";
import bind from "bind-decorator";

const SLEEP_BEFORE_REQUEST_PERMISSION_MIN_MS = 10;
const SLEEP_BEFORE_REQUEST_PERMISSION_MAX_MS = 200;
const BALLOT_STUCK_TIMEOUT_MS = 2000;

interface Message {
  type: string;
  sender: number;
  ballot?: Ballot;
  block?: Block;
  firstUnconfirmedSlot?: number;
  pendingProposals?: Proposal[];
  blockNumber?: number;
}

interface GrantMetadata {
  sender: number;
  firstUnconfirmedSlot: number;
  pendingProposals: Proposal[];
}

export default class HonestNode extends BaseNode {
  protected maxBallot: Ballot;
  protected closedBlocks: Block[] = [];
  protected pendingProposals: Proposal[] = [];
  protected collectingGrants: GrantMetadata[];
  protected collectingAccepts: number; // during propose value
  protected utils: Utils;

  @bind
  startClosingNextUnconfirmedBlock(): void {
    this.maxBallot = { ballotNumber: this.maxBallot.ballotNumber + 1, nodeNumber: this.nodeNumber };
    this.setTimeout(BALLOT_STUCK_TIMEOUT_MS, <Message>{ type: "MaxBallotStuckTimeout", ballot: this.maxBallot });
    this.collectingGrants = [{
      sender: this.nodeNumber,
      firstUnconfirmedSlot: this.closedBlocks.length,
      pendingProposals: this.pendingProposals
    }];
    this.broadcast(<Message>{ type: "RequestPermission", sender: this.nodeNumber, ballot: this.maxBallot });
  }

  @bind
  handleRequestPermission(msg: Message): void {
    if (this.utils.isBallotGreaterEqual(msg.ballot, this.maxBallot)) {
      this.maxBallot = msg.ballot;
      this.setTimeout(BALLOT_STUCK_TIMEOUT_MS, <Message>{ type: "MaxBallotStuckTimeout", ballot: this.maxBallot });
      const firstUnconfirmedSlot = this.closedBlocks.length;
      this.unicast(msg.sender, <Message>{ type: "GrantPermission", sender: this.nodeNumber, ballot: msg.ballot, firstUnconfirmedSlot: firstUnconfirmedSlot, pendingProposals: this.pendingProposals });
    }
  }

  @bind
  handleGrantPermission(msg: Message): void {
    if (!this.utils.isBallotEqual(this.maxBallot, msg.ballot)) {
      return;
    }
    this.collectingGrants.push({
      sender: msg.sender,
      firstUnconfirmedSlot: msg.firstUnconfirmedSlot,
      pendingProposals: msg.pendingProposals
    });
    if (this.utils.isMajority(this.collectingGrants.length)) {
      this.log(`granted permission by majority for ballot ${this.maxBallot.ballotNumber}.${this.maxBallot.nodeNumber}`);
      const maxUnconfirmedSlotGrant = _.maxBy(this.collectingGrants, (grant: GrantMetadata) => grant.firstUnconfirmedSlot);
      const nextSlot = maxUnconfirmedSlotGrant.firstUnconfirmedSlot;
      // learn from my peers about some closed blocks I don't know about
      this.fillInMissingClosedBlocks(nextSlot, this.collectingGrants);
      // find among nextSlot the max ballot and set my value to be this
      let maxBallotInNextSlot: Ballot = undefined;
      let nextBlock: Block = undefined;
      for (const grant of this.collectingGrants) {
        if (grant.pendingProposals[nextSlot]) {
          const proposal = grant.pendingProposals[nextSlot];
          if (!maxBallotInNextSlot || this.utils.isBallotGreaterEqual(proposal.ballot, maxBallotInNextSlot)) {
            maxBallotInNextSlot = proposal.ballot;
            nextBlock = proposal.block;
          }
        }
      }
      // if we have no existing value to use, create a new value
      if (!nextBlock) nextBlock = this.createNewBlock(nextSlot);
      // propose the value
      this.collectingGrants = [];
      this.collectingAccepts = 1;
      this.pendingProposals[nextSlot] = {
        ballot: this.maxBallot,
        block: nextBlock
      };
      this.broadcast(<Message>{ type: "ProposeValue", sender: this.nodeNumber, ballot: this.maxBallot, block: nextBlock });
    }
  }

  @bind
  fillInMissingClosedBlocks(firstUnconfirmedSlot: number, grants: GrantMetadata[]): void {
    let blockNumberToRequest = this.closedBlocks.length;
    while (blockNumberToRequest < firstUnconfirmedSlot) {
      // find a node that has this blockNumber already confirmed
      for (const grant of grants) {
        if (grant.firstUnconfirmedSlot > blockNumberToRequest) {
          this.unicast(grant.sender, <Message>{ type: "RequestClosedBlock", sender: this.nodeNumber, blockNumber: blockNumberToRequest });
          break;
        }
      }
      blockNumberToRequest++;
    }
  }

  @bind
  createNewBlock(blockNumber: number): Block {
    const res: Block = {
      blockNumber: blockNumber,
      content: this.scenario.randomizer.next() // symbolizes transactions
    };
    this.log(`creating a new block for slot ${res.blockNumber} with content ${res.content}`);
    return res;
  }

  @bind
  handleProposeValue(msg: Message): void {
    const slotIndex = msg.block.blockNumber;
    if (this.closedBlocks[slotIndex]) {
      this.unicast(msg.sender, <Message>{ type: "ClosedBlock", sender: this.nodeNumber, block: this.closedBlocks[slotIndex] });
      return;
    }
    if (!this.pendingProposals[slotIndex] || this.utils.isBallotGreaterEqual(msg.ballot, this.pendingProposals[slotIndex].ballot)) {
      this.pendingProposals[slotIndex] = {
        ballot: msg.ballot,
        block: msg.block
      };
      this.unicast(msg.sender, <Message>{ type: "AcceptValue", sender: this.nodeNumber, ballot: msg.ballot, block: msg.block });
    }
  }

  @bind
  handleAcceptValue(msg: Message): void {
    const slotIndex = msg.block.blockNumber;
    if (this.closedBlocks[slotIndex]) {
      this.unicast(msg.sender, <Message>{ type: "ClosedBlock", sender: this.nodeNumber, block: this.closedBlocks[slotIndex] });
      return;
    }
    if (!this.utils.isBallotEqual(this.maxBallot, msg.ballot)) {
      return;
    }
    if (!this.utils.isBallotEqual(this.pendingProposals[slotIndex].ballot, msg.ballot)) {
      this.error(`accepted ballot doesn't match our ballot in pending proposals`);
      return;
    }
    if (this.pendingProposals[slotIndex].block.content != msg.block.content) {
      this.error(`accepted block content doesn't match our block in pending proposals`);
      return;
    }
    this.collectingAccepts++;
    if (this.utils.isMajority(this.collectingAccepts)) {
      this.log(`value accepted by majority for ballot ${this.maxBallot.ballotNumber}.${this.maxBallot.nodeNumber}, content ${msg.block.content}`);
      this.collectingAccepts = 0;
      const closedBlockMessage = <Message>{ type: "ClosedBlock", sender: this.nodeNumber, block: msg.block };
      this.handleClosedBlock(closedBlockMessage);
      this.broadcast(closedBlockMessage);
    }
  }

  @bind
  handleClosedBlock(msg: Message): void {
    if (this.closedBlocks[msg.block.blockNumber]) {
      const existingClosedBlock = this.closedBlocks[msg.block.blockNumber];
      if (existingClosedBlock.content != msg.block.content) {
        this.error(`received two closed blocks with the same block number, we have a fork!`);
        return;
      }
    }
    this.closedBlocks[msg.block.blockNumber] = msg.block;
    this.log(`closed block ${msg.block.blockNumber}`);
    // delete confirmed blocks from start of pendingProposals
    let slot = this.utils.getMinimalSlot(this.pendingProposals);
    while (this.closedBlocks[slot] && this.pendingProposals[slot]) {
      delete this.pendingProposals[slot];
      slot++;
    }
    this.randomSleepBeforeStarting();
  }

  @bind
  handleRequestClosedBlock(msg: Message): void {
    if (!this.closedBlocks[msg.blockNumber]) {
      this.error(`node ${msg.sender} asked me for closed block ${msg.blockNumber} but I don't have it`);
      return;
    }
    this.unicast(msg.sender, <Message>{ type: "ClosedBlock", sender: this.nodeNumber, block: this.closedBlocks[msg.blockNumber] });
  }

  @bind
  getRandomSleepTimeMs(): number {
    return this.scenario.randomizer.nextIntegerInRange(SLEEP_BEFORE_REQUEST_PERMISSION_MIN_MS, SLEEP_BEFORE_REQUEST_PERMISSION_MAX_MS);
  }

  @bind
  randomSleepBeforeStarting(): void {
    this.setTimeout(this.getRandomSleepTimeMs(), <Message>{ type: "SleepBeforeStarting" });
  }

  @bind
  onStart(event: NodeStartEvent): void {
    this.maxBallot = { ballotNumber: 0, nodeNumber: this.nodeNumber };
    this.utils = new Utils(this.scenario.numNodes, this.nodeNumber);
    this.randomSleepBeforeStarting();
  }

  @bind
  onMessage(event: MessageEvent): void {
    const msg = <Message>event.message;
    switch (msg.type) {
      case "RequestPermission": {
        this.handleRequestPermission(msg);
        break;
      }
      case "GrantPermission": {
        this.handleGrantPermission(msg);
        break;
      }
      case "ProposeValue": {
        this.handleProposeValue(msg);
        break;
      }
      case "AcceptValue": {
        this.handleAcceptValue(msg);
        break;
      }
      case "RequestClosedBlock": {
        this.handleRequestClosedBlock(msg);
        break;
      }
      case "ClosedBlock": {
        this.handleClosedBlock(msg);
        break;
      }
    }
  }

  @bind
  onTimeout(event: TimeoutEvent): void {
    const msg = <Message>event.message;
    switch (msg.type) {
      case "SleepBeforeStarting": {
        this.startClosingNextUnconfirmedBlock();
        break;
      }
      case "MaxBallotStuckTimeout": {
        if (this.utils.isBallotEqual(msg.ballot, this.maxBallot)) {
          this.randomSleepBeforeStarting();
        }
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
