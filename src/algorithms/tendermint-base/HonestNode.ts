import * as _ from "lodash";
import { Utils, Block, Proposal } from "./common";
import BaseNode from "../../simulation/BaseNode";
import BaseEvent from "../../simulation/BaseEvent";
import MessageEvent from "../../simulation/events/MessageEvent";
import TimeoutEvent from "../../simulation/events/TimeoutEvent";
import NodeStartEvent from "../../simulation/events/NodeStartEvent";
import bind from "bind-decorator";

const SLEEP_BEFORE_REQUEST_PERMISSION_MIN_MS = 10;
const SLEEP_BEFORE_REQUEST_PERMISSION_MAX_MS = 200;
const PROPOSAL_STUCK_TIMEOUT_MS = 2000;

interface Message {
  type: string;
  sender: number;
  round: number;
  block?: Block;
  proposal: Proposal;
}

export default class HonestNode extends BaseNode {
  protected closedBlocks: Block[] = [];
  protected nodeOrder: number[];
  protected roundNumber: number;
  protected lockRound: number;
  protected lockedBlock: Block = undefined;
  protected collectingPrevotes: Proposal[];
  protected collectingPrecommits: boolean[]; // during propose value
  protected utils: Utils;

  @bind
  startClosingNextUnconfirmedBlock(): void {
    this.setTimeout(PROPOSAL_STUCK_TIMEOUT_MS, <Message>{ type: "ProposalStuckTimeout", round: this.roundNumber });
    let blockToPropose: Block = undefined;
    const newHeight: number = this.closedBlocks.length + 1;
    if (this.lockedBlock) {
      blockToPropose = this.lockedBlock;
    }
    else {
      blockToPropose = this.createNewBlock(newHeight);
    }
    const proposal: Proposal = { block: blockToPropose, height: newHeight, round: this.roundNumber, proposerID: this.nodeNumber };
    this.collectingPrevotes = [];
    this.collectingPrevotes[this.nodeNumber] = proposal;
    this.broadcast(<Message>{ type: "ProposeBlock", sender: this.nodeNumber, proposal: proposal });
  }

  @bind
  handleProposeBlock(msg: Message): void {
    if (!this.isValidProposal) {
      // TODO prevote nil
    }
    this.setTimeout(PROPOSAL_STUCK_TIMEOUT_MS, <Message>{ type: "ProposalStuckTimeout", round: this.roundNumber });
    // validators should broadcast their votes to the rest, and update their vote counter (for their own vote)
    this.broadcast(<Message>{ type: "VoteMessage", sender: this.nodeNumber, proposal: msg.proposal });
    this.collectingPrevotes[this.nodeNumber] = msg.proposal;
    // maybe they are the last of the 2f+1 validators to get the proposal, in which this case they have seen a polka and handle it TODO revise this in
    if (this.utils.isPolka(this.utils.countProposal(msg.proposal, this.collectingPrevotes))) {
      this.handlePolka(msg.proposal);
    }
  }

  @bind
  handlePolka(proposal: Proposal): void {
    // TODO
    return;
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
  isValidBlock() {
    // currently just placeholder, should check txs, pointer to lest block, etc...
    return true;
  }

  @bind
  isValidProposal(prpsMsg: Message): boolean {
    if (!this.isValidBlock) {
      return false;
    }
    if (prpsMsg.proposal.height != this.closedBlocks.length + 1) {
      this.warn(`Not in sync! Received block at height ${prpsMsg.proposal.height}, expected block at height ${this.closedBlocks.length + 1}!`);
    }
    // message proposal is out of order, should be ignored
    if (prpsMsg.sender != this.nodeOrder[this.roundNumber]) {
      return false;
    }
    // prevote-the-lock: if node is locked on a block they must prevote for it TODO  and only it??
    if (this.lockedBlock) {
      if (!this.utils.isBlockEqual(prpsMsg.proposal.block, this.lockedBlock)) {
        return false;
      }
    }
    return true;
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
    this.roundNumber = 0;
    this.utils = new Utils(this.scenario.numNodes, this.nodeNumber);
    // if first in round robin, start closing next block
    if (this.nodeNumber == this.nodeOrder[this.roundNumber]) {
      this.startClosingNextUnconfirmedBlock();
    }
  }

  @bind
  onMessage(event: MessageEvent): void {
    const msg = <Message>event.message;
    switch (msg.type) {
      case "ProposeBlock": {
        this.handleProposeBlock(msg);
        break;
      }
      case "VoteMessage": {
        // TODO implement
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
      case "ProposalStuckTimeout": {
        // TODO CHECK if proposal is stuck
        if (true) {
          // prevote nil
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
