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
  round?: number;
  block?: Block;
  proposal?: Proposal;
}

export default class HonestNode extends BaseNode {
  protected closedBlocks: Block[] = [];
  protected nodeOrder: number[] = [];
  protected roundNumber: number;
  protected lockedProposal: Proposal = undefined;
  protected inPrevoteStage: boolean;
  protected inPreCommitStage: boolean;
  protected collectingPrevotes: Proposal[];
  protected collectingPrecommits: Proposal[]; // during propose value
  protected utils: Utils;

  @bind
  startClosingNextUnconfirmedBlock(): void {
    this.setTimeout(PROPOSAL_STUCK_TIMEOUT_MS, <Message>{ type: "ProposalStuckTimeout", round: this.roundNumber });
    let blockToPropose: Block = undefined;
    const newHeight: number = this.closedBlocks.length + 1;
    if (this.lockedProposal) {
      blockToPropose = this.lockedProposal.block;
    }
    else {
      blockToPropose = this.createNewBlock(newHeight);
    }
    const proposal: Proposal = { proposalID: this.scenario.randomizer.next(), block: blockToPropose, height: newHeight, round: this.roundNumber, proposerID: this.nodeNumber };
    this.collectingPrevotes = [];
    this.collectingPrevotes[this.nodeNumber] = proposal;
    this.broadcast(<Message>{ type: "ProposeBlock", sender: this.nodeNumber, proposal: proposal });
    this.inPrevoteStage = true;
  }

  @bind
  handleProposeBlock(msg: Message): void {
    if (this.isValidProposal(msg)) {
      this.inPrevoteStage = true;
      this.collectingPrevotes[msg.sender] = msg.proposal;
      // validators should broadcast their votes to the rest, and update their vote counter (for their own vote)
      const voteMsg: Message = { type: "VoteMessage", sender: this.nodeNumber, proposal: msg.proposal };
      this.broadcast(voteMsg);
      this.handleVoteMessage(voteMsg);
    }

    return;
  }

  @bind
  handleVoteMessage(msg: Message): void {
    // TODO this could happen before proposal even received, check desired behavior
    if (!this.collectingPrevotes[msg.sender] && this.closedBlocks.length + 1 == msg.proposal.height) this.collectingPrevotes[msg.sender] = msg.proposal;
    else this.log(`ignored message ${JSON.stringify(msg)}`);
    if (this.inPrevoteStage) {
      // maybe they are the last of the 2f+1 validators to get the proposal, in which this case they have seen a polka and handle it
      const res: Proposal = this.utils.getPolkaProposal(this.collectingPrevotes);
      if (res) this.handlePolkaPrevote(res);
      else {
        // this.log(`No polka for prevote`);
        // this.utils.printProposals(this.collectingPrevotes);
      }
    }
    return;
  }

  @bind
  handlePolkaPrevote(proposal: Proposal): void {
    // if validator locked on a previous precommit, he won't precommit to a  new block until he sees a polka for a new precommit.
    if (this.lockedProposal && !this.utils.isProposalEqual(this.lockedProposal, proposal)) {
      this.log(`Locked on previous precommitted proposal ${this.lockedProposal.proposalID} with block {${this.lockedProposal.block.blockNumber}, ${this.lockedProposal.block.content}, different from ${proposal.proposalID} with block {${proposal.block.blockNumber}, ${proposal.block.content}}`);
    }
    else { // pre-commit this proposal
      this.log(`observed prevote polka for proposal ${proposal.proposalID} with content of block {${proposal.block.blockNumber}, ${proposal.block.content}}`);
      this.lockedProposal = proposal;
      this.inPrevoteStage = false;
      this.inPreCommitStage = true;
      const preCommitMsg: Message = { type: "PrecommitMessage", sender: this.nodeNumber, proposal: proposal };
      this.broadcast(preCommitMsg);
      this.handlePrecommitMessage(preCommitMsg);
    }
    return;
  }

  @bind
  handlePrecommitMessage(msg: Message): void {
    // TODO this could happen before proposal even received, check desired behavior
    if (!this.collectingPrecommits[msg.sender] && this.closedBlocks.length + 1 == msg.proposal.height) this.collectingPrecommits[msg.sender] = msg.proposal;
    else this.log(`ignored message ${JSON.stringify(msg)}`);
    if (this.inPreCommitStage) {
      // maybe they are the last of the 2f+1 validators to get the proposal, in which this case they have seen a polka and handle it
      const res: Proposal = this.utils.getPolkaProposal(this.collectingPrecommits);
      if (res) this.handlePolkaPrecommit(res);
      else {
        // this.log(`No polka for precommit`);
        // this.utils.printProposals(this.collectingPrecommits);
      }
    }
    return;
  }

  @bind
  handlePolkaPrecommit(proposal: Proposal): void {
    this.log(`observed precommit polka for proposal ${proposal.proposalID} with content of block {${proposal.block.blockNumber}, ${proposal.block.content}}`);
    if (this.lockedProposal && (this.lockedProposal.round < this.roundNumber)) {
      this.lockedProposal = proposal; // once validator sees precommit polka at a higher round than that he locked on, he can relock on the newer block and precommit to it.
    }
    // move to new round
    if (this.utils.isNilProposal(proposal)) {
      this.beginNewRound(this.roundNumber + 1);
    }
    else {
      const closedBlockMsg: Message = { type: "closedBlockMessage", sender: this.nodeNumber, proposal: proposal };
      this.handleClosedBlockMessage(closedBlockMsg);
    }
    return;
  }

  @bind
  handleClosedBlockMessage(msg: Message): void {
    if ((this.closedBlocks.length + 1 == msg.proposal.height)) {
      this.closedBlocks.push(msg.proposal.block);
      this.broadcast(msg);
      this.beginNewRound(0);
    }
    else this.log(`ignored message ${JSON.stringify(msg)}`);
    return;
  }

  @bind
  beginNewRound(roundNumber: number): void {
    // begin new round of voting
    this.log(`beginning new round ${roundNumber} at height ${this.closedBlocks.length + 1 }`);
    // giving leader time to propose and close a block
    this.setTimeout(PROPOSAL_STUCK_TIMEOUT_MS, <Message>{ type: "ProposalStuckTimeout", round: this.roundNumber });
    this.roundNumber = roundNumber;
    this.lockedProposal = undefined;
    this.collectingPrevotes = [];
    this.collectingPrecommits = [];
    this.inPrevoteStage = false;
    this.inPreCommitStage = false;
    if (this.nodeOrder[this.roundNumber] == this.nodeNumber) {
      this.startClosingNextUnconfirmedBlock();
    }
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
  createNilVote(): Proposal {
    const nilBlock: Block = this.utils.createNilBlock();
    const nilVote: Proposal = {
      proposalID: -1,
      block: nilBlock,
      height: this.closedBlocks.length + 1,
      round: this.roundNumber,
      proposerID: this.nodeNumber
    };
    return nilVote;
  }

  @bind
  isValidBlock() {
    // currently just placeholder, should check txs, pointer to last block, etc...
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
    if (this.lockedProposal) {
      if (!this.utils.isBlockEqual(prpsMsg.proposal.block, this.lockedProposal.block)) {
        this.log(`Locked on previous precommitted proposal ${this.lockedProposal.proposalID} with block {${this.lockedProposal.block.blockNumber}, ${this.lockedProposal.block.content}, different from ${prpsMsg.proposal.proposalID} with block {${prpsMsg.proposal.block.blockNumber}, ${prpsMsg.proposal.block.content}}`);
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
    const order: number[] = [];
    for (let i = 1; i <= this.scenario.numNodes; i++) {
      this.nodeOrder.push(i);
    }
    this.utils = new Utils(this.scenario.numNodes, this.nodeNumber);
    this.beginNewRound(0);
  }

  @bind
  onMessage(event: MessageEvent): void {
    const msg = <Message>event.message;
    this.log(`Received ${JSON.stringify(msg)}`);
    switch (msg.type) {
      case "ProposeBlock": {
        this.handleProposeBlock(msg);
        break;
      }
      case "VoteMessage": {
        this.handleVoteMessage(msg);
        break;
      }
      case "PrecommitMessage": {
        this.handlePrecommitMessage(msg);
        break;
      }
      case "closedBlockMessage": {
        this.handleClosedBlockMessage(msg);
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
