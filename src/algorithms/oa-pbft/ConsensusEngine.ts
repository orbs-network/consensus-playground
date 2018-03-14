import * as _ from "lodash";
import { Message, Cmap, Utils, Block, EncryptedBlock, DecryptedBlock, BlockProof, ConsensusMessageType, Proposal, BlockShare } from "./common";
import * as Common from "./common";
import Logger from "../../simulation/Logger";
import { Blockchain } from "./Blockchain";
import { Decryptor } from "./Decryptor";
import { Mempool } from "./Mempool";
import { Timer } from "./Timer";
import { Syncer } from "./Syncer";
import { NetworkInterface } from "./NetworkInterface";


import bind from "bind-decorator";

const PROPOSAL_TIMER_MS = 2000;

enum Phase { // not used yet
    Agreeing,
    Waiting,
    Decrypting,
    Syncing
}

enum State {
  Init = 0,
  PrePrepared = 1,
  Prepared = 2,
  Committed = 3
}

// contains current PBFT state information
export interface PBFTState {
  view: number;
  candidateEBlock: EncryptedBlock;
  outOfSyncMessages: Message[];
  prepMessages: Message[];
  commitMessages: Message[];
  prepared: boolean;
  committedLocal: boolean;
  blockProof: BlockProof;
  viewChangeMessages: Message[];
  newViewMessages: Message[];
  collectingViewChangeMsgs: boolean;
  progress: State;
}



export class ConsensusEngine {
  protected nodeNumber: number;
  protected numNodes: number;
  protected decryptor: Decryptor;
  protected blockchain: Blockchain;
  protected mempool: Mempool;
  protected netInterface: NetworkInterface;
  protected timer: Timer;
  protected syncer: Syncer;
  protected sleeping: boolean = false;

  protected cmap: Cmap;
  protected term: number;
  protected phase: Phase;
  protected pbftState: PBFTState;
  protected utils: Utils;

  constructor(nodeNumber: number, decryptor: Decryptor, blockchain: Blockchain, mempool: Mempool, netInterface: NetworkInterface, utils: Utils, timer: Timer = undefined) {
    this.nodeNumber = nodeNumber;
    this.decryptor = decryptor;
    this.blockchain = blockchain;
    this.mempool = mempool;
    this.netInterface = netInterface;
    this.timer = timer;
    this.syncer = undefined;

    this.phase = undefined;
    this.term = 0;
    this.utils = utils;
    this.initPBFT_State();
  }

  @bind
  getTerm(): number {
    return this.term;
  }

  @bind
  getViewNumber(): number {
    return this.pbftState.view;
  }

  @bind
  getConMsgLevel(conMsgType: ConsensusMessageType): number {
    switch (conMsgType) {
      case ConsensusMessageType.PrePrepare: {
        return 1;
      }
      case ConsensusMessageType.Prepare: {
        return 2;
      }
      case ConsensusMessageType.Commit: {
        return 3;
      }
      default: {
        this.utils.logger.error(`Currently supporting only Preprepare, Prepared and Commit type messages`);
        return -1;
      }
    }
  }

 /**
  * Given previous block, output new ordering and (future) reputation updates
  * @param block - Decrypted block to generate new Cmap from
  */
  @bind
  sortition(block: DecryptedBlock): Cmap {
    const seed: string = block.hash;
    return new Cmap(this.utils.numNodes, seed, block.cmap);
  }

 /**
  * Initialize consensus algorithm and enter first term. Called after all nodes have been generated.
  * TODO in the future this should contain more detailed information about each node * and not just numbers. check to see if needed or utils alreay initialized
  * @param numNodes - total number of nodes in network (n)
  * @param committeeSize - committee size (m)
  * @param numByz - assumed number of Byzantine nodes (f)
  */
  @bind
  initConsensus(numNodes: number, committeeSize: number, numByz: number, syncer: Syncer): void {
    this.utils.numNodes = numNodes;
    this.utils.committeeSize = committeeSize;
    this.utils.numByz = numByz;
    this.syncer = syncer;
    const lastDecryptedBlock = this.blockchain.getLastBlock().decryptedBlock;
    this.enterNewTerm(lastDecryptedBlock);
  }

 /**
  * Begin new instance of PBFT for a new block-height, with the new committee set  according to the last decrypted block.
  * @param lastDBlock - The decrypted block of the previous round
  */
  @bind
  enterNewTerm(lastDBlock: DecryptedBlock, inSyncMode: boolean = false): void {

    this.cmap = this.sortition(lastDBlock);
    this.initPBFT_State();
    // this.term += 1;
    // this.term = Math.max(this.term, lastDBlock.term) + 1;
    this.term = lastDBlock.term + 1;
    this.utils.logger.log(`Entering term ${this.term}, committee is ${this.utils.getCommittee(this.cmap)}`);

    this.setCollectingViewChanges();
    if (inSyncMode) {
      this.phase = Phase.Syncing;
      this.timer.stopTimer();
    }
    else if (this.utils.isLeader(this.cmap, this.nodeNumber, this.pbftState.view)) {
      this.utils.logger.log(`Chosen as leader`);
      this.timer.setProposalTimer(PROPOSAL_TIMER_MS);
      this.phase = Phase.Agreeing; // TODO fix phases
      const eBlock: EncryptedBlock = this.createNewEBlock();
      // this.pbftState.candidateEBlock = eBlock;
      const prePrepMsg: Message = { sender: this.nodeNumber, type: "ConsensusMessage" + "/" + ConsensusMessageType.PrePrepare, conMsgType: ConsensusMessageType.PrePrepare, term: this.term, view: this.pbftState.view, eBlock: eBlock, eBlockHash: eBlock.hash, size_bytes: (this.utils.scenario.oaConfig.networkConfiguration.numEtxsPerBlock * this.utils.scenario.oaConfig.networkConfiguration.etxSizeBytes + this.utils.scenario.oaConfig.networkConfiguration.defaultMsgSizeBytes) };
      this.multicastCommittee(prePrepMsg);
      this.handlePrePrepareMessage(prePrepMsg); // "sending the message to ourselves" since handling is identical
    }
    else if (this.utils.isCommitteeMember(this.cmap, this.nodeNumber)) {
      this.timer.setProposalTimer(PROPOSAL_TIMER_MS);
      this.phase = Phase.Waiting; // TODO fix phases
      this.recheckConMessages([ConsensusMessageType.PrePrepare, ConsensusMessageType.Prepare, ConsensusMessageType.Commit]); // sync on messages from previous term
    }
    else {
      // node not participating in PBFT this term, stop timers from previous terms
      this.timer.stopTimer();
    }


  }

 /**
  * Triggered by the Decryptor component upon completion of the block decryption.
  * New block can be added to block chain and a new term entered.
  */
  @bind
  handleBlockDecrypted(dBlock: DecryptedBlock, eBlock: EncryptedBlock, blockShares: BlockShare[]): void {
    this.utils.logger.log(`Block ${eBlock.term} decrypted.`);
    const block = this.createBlock(eBlock, dBlock, this.pbftState.blockProof, blockShares);
    this.blockchain.addBlock(block);
    this.utils.logger.debug(`Added block ${JSON.stringify(block)} to blockchain...`);
    if (this.term <= dBlock.term) {
        this.enterNewTerm(dBlock);
    }
  }

  @bind
  initPBFT_State(): void {
    if (this.pbftState) this.utils.logger.debug(`Initializing PBFT state, out of sync messages are ${JSON.stringify(this.pbftState.outOfSyncMessages)}`);
    const futureMsgs = (this.pbftState) ? this.pbftState.outOfSyncMessages.filter( msg => (msg.term >= this.term) ) : [] ;
    const newViewMsgs = (this.pbftState) ? this.pbftState.newViewMessages.filter( msg => (msg.term >= this.term) ) : [] ;
    this.utils.logger.debug(`Initializing PBFT state, future messages are ${JSON.stringify(futureMsgs)}`);
    this.utils.logger.debug(`Initializing PBFT state, newView messages are ${JSON.stringify(newViewMsgs)}`);
    this.pbftState = { view: 1, candidateEBlock: undefined, outOfSyncMessages: futureMsgs, prepMessages: [], commitMessages: [], prepared: false, committedLocal: false, blockProof: this.createNewBP(), viewChangeMessages: new Array(this.utils.numNodes).fill(undefined), collectingViewChangeMsgs: false, newViewMessages: newViewMsgs, progress: State.Init };

  }

  @bind
  multicastCommittee(msg: Message): void {
    this.netInterface.multicast(this.utils.getCommittee(this.cmap), msg);
  }

  /**
   * Check if message is in sync with node's current state - on same term and with valid view
   * @param message - Some ConsensusMessage
   */
  @bind
  isMessageInSync(msg: Message): boolean {
    if ((msg.view < this.pbftState.view) || (msg.term < this.term)) return false; // ignore messages from the past
    if ((!this.isMessageViewValid(msg)) || (msg.term > this.term)) {
      return false; // save messages from the future for possible validation
    }
    return true;

  }

  @bind
  isMessageFromFuture(msg: Message): boolean {
    if (((this.getConMsgLevel(msg.conMsgType) > (this.pbftState.progress + 1)) && (msg.term == this.term)) || (msg.term > this.term) || (msg.view > this.pbftState.view)) {
      this.utils.logger.debug(`Message ${JSON.stringify(msg)} is from the future, at term,view ${this.term},${this.pbftState.view} and level ${this.pbftState.progress}, message at term ${msg.term},${msg.view} and level ${this.getConMsgLevel(msg.conMsgType)}}`);
      return true;
    }
    return false;

  }


  @bind
  isValidEBlockHash(eBlockHash: string): boolean {
    if (eBlockHash != this.pbftState.candidateEBlock.hash) {
      this.utils.logger.debug(`Mismatching hash- receieved ${eBlockHash}, expected ${this.pbftState.candidateEBlock.hash}`);
      return false;
    }
    return true;
  }

  isRepresentativeEBlock(eBlock: EncryptedBlock): boolean {
    // dummy implementation, should verify EB contains at least one of node's etxs
    // if () {
    //   this.utils.logger.warn(`Received invalid pre-prepare message from ${msg.sender}, EB didn't contain any of my etxs!}`);
    // }
    return true;
  }



  @bind
  createNewEBlock(): EncryptedBlock {
    const randomContent = this.mempool.generateContent();
    const contentHash: string = Utils.hashContent(randomContent);
    const eBlock: EncryptedBlock = { term: this.term, view: this.pbftState.view, content: randomContent, hash: contentHash, lastEBlockHash: this.blockchain.getLastBlock().encryptedBlock.hash, lastDBlockHash: this.blockchain.getLastBlock().decryptedBlock.hash, creator: this.nodeNumber, cmap: this.cmap };
    return eBlock;
  }

  @bind
  createNewBP(): BlockProof {
    const blockProof: BlockProof = { term: this.term, hash: undefined, prepares: new Array(this.utils.numNodes).fill(false), commits: new Array(this.utils.numNodes).fill(false), committed: false };
    blockProof.committed = false;
    return blockProof;

  }
  /**
   * Given array of proposals or boolean indicator array, count number of votes. Assuming validity of the entries.
   * @param VoteArr - array of booleans or general objects such as messages
   * @return {number} - number of true/existing objects is returned
   */
  @bind
  countValidVotes(voteArr: any[], cmap: Cmap): number {
    let count = 0;
    for (let i = 0; i < voteArr.length; i++) {
      if (voteArr[i]) {
        if (this.utils.isCommitteeMember(cmap, i + 1)) {
          count += 1;
        }
        else {
          this.utils.logger.warn(`${i + 1} submitted a vote, but not on committee!`);
        }
      }
    }
    return count;
  }

  /**
   * Given array of proposals or boolean indicator array, check if votes constitute a
   * 2/3+ majority. Assuming validity of the proposals.
   * @param VoteArr - array of booleans or general objects
   * @param cmap - committee map
   * @return {number} - number of true/existing objects is returned
   */
  @bind
  isValidByzMajorityVote(voteArr: any[], cmap: Cmap): boolean { // any to allow use with arrays of objects as well
    return this.utils.isByzMaj(this.countValidVotes(voteArr, cmap));
  }

  @bind
  isValidCommitteeMessage(msg: Message): boolean {
    if (!this.utils.isCommitteeMember(this.cmap, msg.sender)) {
      if (this.isMessageInSync(msg)) {
        this.utils.logger.warn(`Got message from non-committee member ${msg.sender}, committee is ${this.utils.getCommittee(this.cmap)}. Message = ${JSON.stringify(msg)}`);
      }
      return false;
    }

    if (!this.utils.isCommitteeMember(this.cmap, this.utils.nodeNumber)) {
      if (this.isMessageInSync(msg)) {
        this.utils.logger.warn(`Received message but I'm not a committee member`);
      }
      return false;
    }
    return true;

  }

  @bind
  isMessageViewValid(msg: Message): boolean {
    if (msg.view == this.pbftState.view) return true;
    if ((msg.conMsgType == ConsensusMessageType.NewView) || (msg.conMsgType == ConsensusMessageType.ViewChange)) {
      if (msg.view == this.pbftState.view + 1) return true;
    }
    return false;
  }

  @bind
  isValidMessageType(msg, conMsgType: ConsensusMessageType): boolean {
    if (msg.conMsgType != conMsgType) {
      this.utils.logger.debug(`Expected message of type ${conMsgType}, got message of type ${msg.conMsgType}`);
      return false;
    }
    return true;
  }

  @bind
  isValidEncryptedBlock(eBlock: EncryptedBlock, inNewViewStage: boolean = false): boolean {
    if (this.term != eBlock.term) {
      if (this.term < eBlock.term) {
        this.utils.logger.warn(`Received EB (${eBlock.term},${eBlock.hash}), at term ${this.term} - out of sync!`);
        // TODO sync
      }
      return false;
    }

    if (Utils.hashContent(eBlock.content) != eBlock.hash) {
      this.utils.logger.warn(`Received EB (${eBlock.term},${eBlock.hash}), should be hash ${Utils.hashContent(eBlock.content)}`);
      return false;
    }

    // check pointers to previous blocks
    if ((this.blockchain.getLastBlock().encryptedBlock.hash != eBlock.lastEBlockHash) || (this.blockchain.getLastBlock().decryptedBlock.hash != eBlock.lastDBlockHash)) {
      this.utils.logger.warn(`Received EB with pointer ${eBlock.lastEBlockHash} to last EB and pointer ${eBlock.lastDBlockHash} to last DB, but mine are ${this.blockchain.getLastBlock().encryptedBlock.hash} and ${this.blockchain.getLastBlock().decryptedBlock.hash}`);
      return false;
    }
    const block: Block = this.blockchain.getClosedBlocksMap()[eBlock.term];
    if (block) {
        const cmap = this.sortition(block.decryptedBlock);
        if (!Utils.areCmapsEqual(cmap, eBlock.cmap)) {
        this.utils.logger.warn(`Locally computed cmap ${cmap} different than cmap ${eBlock.cmap} received in block ${eBlock.term}!`);
        return false;
        }
    }

    // if eBlock view is greater than 1, make sure corresponding NewView message exists
    // if we're in the midst of validating a new view message, ignore this section - the new view message validity depends on the validity of the eBlock, so we avoid a circular dependency TODO recheck this
    if (eBlock.view > 1 && !inNewViewStage) {
      const newViewMessages = this.pbftState.newViewMessages.filter(m => (m.view == eBlock.view));
      if (newViewMessages.length != 1) {
        this.utils.logger.error(`Have more than one new view message corresponding to view ${eBlock.view}, new view messages are ${JSON.stringify(this.pbftState.newViewMessages)}`);
        return false;
      }
      else {
        if (newViewMessages[0].newPrePrepMsg.eBlock.hash != eBlock.hash) {
          this.utils.logger.error(`Eblock ${JSON.stringify(eBlock)} doesn't correspond to NewView message Eblock ${JSON.stringify(newViewMessages[0].newPrePrepMsg.eBlock)}`);
          return false;
        }
      }
    }

    // check creator matches leader of corresponding view
    if (!this.utils.isLeader(this.cmap, eBlock.creator, eBlock.view)) {
      this.utils.logger.warn(`Received pre-prepare EB created by ${eBlock.creator}, expected from ${eBlock.cmap[eBlock.view]}`);
      return false;
    }

    if (!this.isRepresentativeEBlock(eBlock)) {
      return false;
    }

    return true;

  }

  @bind
  isValidPrePrepareMessage(msg: Message, inNewViewStage: boolean = false): boolean {
    if (!this.isValidMessageType(msg, ConsensusMessageType.PrePrepare)) {
      this.utils.logger.debug(`invalid message type ${JSON.stringify(msg)}`);
      return false;
    }
    if (!this.isMessageInSync(msg)) {
      this.utils.logger.debug(`message not in sync ${JSON.stringify(msg)}`);
      return false;
    }
    if (!this.isValidCommitteeMessage(msg)) {
      this.utils.logger.debug(`invalid committee message ${JSON.stringify(msg)}`);
      return false;
    }
    // Check the message is from the correct leader
    if (!this.utils.isLeader(this.cmap, msg.sender, msg.view)) {
      this.utils.logger.warn(`Received pre-prepare message from ${msg.sender}, expected from ${this.cmap[this.pbftState.view]}`);
      return false;
    }
    // if in sync, we shouldn't receive more than 1 different preprepare message for this term
    if (this.pbftState.prepared && this.pbftState.candidateEBlock && (this.pbftState.candidateEBlock.hash != msg.eBlock.hash)) {
      this.utils.logger.warn(`Received preprepare message ${JSON.stringify(msg)}, already received one for current term ${this.term} with block (${this.pbftState.candidateEBlock.term},${this.pbftState.candidateEBlock.hash})`);
      return false;
    }

    if (!Utils.areCmapsEqual(this.cmap, msg.eBlock.cmap)) {
      this.utils.logger.warn(`Locally computed cmap ${this.cmap} different than cmap ${msg.eBlock.cmap} received in block!`);
      return false;
    }

    if (!this.isValidEncryptedBlock(msg.eBlock, inNewViewStage)) {
      return false;
    }

    return true;
  }

  @bind
  isValidPrepareMessage(msg: Message, view: number): boolean {
    if (!this.isValidMessageType(msg, ConsensusMessageType.Prepare)) return false;
    if (!this.isMessageInSync(msg)) return false;
    if (!this.isValidCommitteeMessage(msg)) return false;
    if (!this.pbftState.candidateEBlock) {
      this.utils.logger.debug(`Receieved ${JSON.stringify(msg)}, but have no candidate EB!`);
      // this.pbftState.outOfSyncMessages.push(msg);
      return false;
    }
    if (!this.isValidEBlockHash(msg.eBlockHash)) {
      this.utils.logger.debug(`Invalid Eblock (${msg.eBlockHash}), msg=${JSON.stringify(msg)}`);
      return false;
    }
    return true;
  }

  @bind
  isValidCommitMessage(msg: Message): boolean {
    if (!this.isValidMessageType(msg, ConsensusMessageType.Commit)) return false;
    if (!this.isMessageInSync(msg)) return false;
    if (!this.isValidCommitteeMessage(msg)) return false;
    if (!this.pbftState.prepared) {
      this.utils.logger.debug(`Receieved Commit message ${JSON.stringify(msg)}, but not in Prepared state!`);
      return false;
    }
    if (!this.isValidEBlockHash(msg.eBlockHash)) {
      this.utils.logger.debug(`Invalid Eblock (${msg.eBlockHash}), msg=${JSON.stringify(msg)}`);
      return false;
    }
    return true;
  }

  /**
   * Check if a message is a valid ConsensusMessage of the desired type.
   */
  @bind
  isValidConMsg(msg: Message, conMsgType: ConsensusMessageType): boolean {
    switch (conMsgType) {
      case ConsensusMessageType.PrePrepare: {
        return this.isValidPrePrepareMessage(msg);
      }
      case ConsensusMessageType.Prepare: {
        return this.isValidPrepareMessage(msg, this.pbftState.view);
      }
      case ConsensusMessageType.Commit: {
        return this.isValidCommitMessage(msg);
      }
      default: {
        this.utils.logger.error(`Currently supporting only Preprepare, Prepared and Commit type messages`);
        return false;
      }

    }
  }

  /**
   * Record evidence according to type of message. Assuming message validity.
   */
  @bind
  updateEvidence(msg: Message): void {
    switch (msg.conMsgType) {
      case ConsensusMessageType.Prepare: {
        this.pbftState.blockProof.prepares[msg.sender - 1] = true;
        this.pbftState.prepMessages[msg.sender - 1] = msg;
        break;
      }
      case ConsensusMessageType.Commit: {
        this.pbftState.blockProof.commits[msg.sender - 1] = true;
        this.pbftState.commitMessages[msg.sender - 1] = msg;
        break;
      }
      case ConsensusMessageType.PrePrepare: {
        this.handlePrePrepareMessage(msg);
        break;
      }
      case ConsensusMessageType.ViewChange: {
        this.pbftState.viewChangeMessages[msg.sender - 1] = msg;
        break;
      }
      case ConsensusMessageType.NewView: {
        this.pbftState.newViewMessages.push(msg);
        break;
      }
    }
  }

  /**
   * Handle pre-prepare message. If valid, update candidate EB and
   * broadcast prepare message to the committee.
   */
  @bind
  handlePrePrepareMessage(msg: Message): void {
    if (this.isMessageFromFuture(msg)) {
      this.pbftState.outOfSyncMessages.push(msg);
      return;
    }
    if (!this.isValidPrePrepareMessage(msg)) {
      this.utils.logger.debug(`invalid message  ${JSON.stringify(msg)}`);
      return;
    }

    this.utils.logger.debug(`Received pre-prepare message for block (${msg.eBlock.term},${msg.eBlock.hash}) from ${msg.sender}`);
    this.pbftState.candidateEBlock = msg.eBlock;
    this.pbftState.progress = State.Prepared;
    this.pbftState.blockProof.term = msg.eBlock.term;
    this.pbftState.blockProof.hash = msg.eBlock.hash;

    const prepareMsg: Message = { sender: this.nodeNumber, type: "ConsensusMessage" + "/" + ConsensusMessageType.Prepare, conMsgType: ConsensusMessageType.Prepare, term: this.term, view: this.pbftState.view, eBlockHash: msg.eBlock.hash, size_bytes: this.utils.scenario.oaConfig.networkConfiguration.defaultMsgSizeBytes };
    if (!this.utils.isLeader(this.cmap, this.nodeNumber, this.pbftState.view)) { // shortcut, committee members that receive pre-prepare should generate the corresponding prepare msg from the leader
    // and save bandwidth (the leader doesn't need to send another prepare message after the preprepare)
      this.utils.logger.debug(`generating leader's prepare ${msg.sender}`);
      const leaderPrepareMsg: Message = { sender: msg.sender, type: "ConsensusMessage" + "/" + ConsensusMessageType.Prepare, conMsgType: ConsensusMessageType.Prepare, term: this.term, view: this.pbftState.view, eBlockHash: msg.eBlock.hash };
      this.updateEvidence(leaderPrepareMsg);
      this.multicastCommittee(prepareMsg);
    }
    this.handlePrepareMessage(prepareMsg);
    return;
  }

  /**
   * Handle prepare message. If valid, check if received 2f+1 messages needed to enter * Prepared state.
   */
  @bind
  handlePrepareMessage(msg: Message): void {
    // TODO what about the case where we receive 2f+1 prepare messages before preprepare? A: can ask for the prepare message
    this.recheckConMessages([ConsensusMessageType.PrePrepare, ConsensusMessageType.Prepare, ConsensusMessageType.Commit]);
    if (this.isMessageFromFuture(msg)) {
      this.pbftState.outOfSyncMessages.push(msg);
      return;
    }
    if (!this.isValidConMsg(msg, ConsensusMessageType.Prepare)) {
      return;
    }

    this.updateEvidence(msg);
    this.utils.logger.debug(`Received ${this.countValidVotes(this.pbftState.blockProof.prepares, this.cmap)} votes out of ${this.pbftState.blockProof.prepares.length}, is ${this.pbftState.blockProof.prepares}, out of sync messages are ${JSON.stringify(this.pbftState.outOfSyncMessages)}`);
    if (this.isValidByzMajorityVote(this.pbftState.blockProof.prepares, this.cmap) && this.pbftState.candidateEBlock && !this.pbftState.prepared) {
      this.enterPrepared();
    }
  }

  /**
   * Process the out-of-sync messages, in case state changes have rendered some valid. * Validated messages will be removed from out-of-sync array.
   * Done before checking for majority votes, so that most up-to-date information will * be taken into account.
   */
  @bind
  recheckConMessages(cmTypeArray: ConsensusMessageType[]): void {
    let allOutOfSyncMsgs = [];
    let allValidMsgs = [];
    for (const cmType of cmTypeArray) {
      const msgs = this.pbftState.outOfSyncMessages.filter( msg => msg.conMsgType == cmType);
      const outOfSyncMessages = msgs.filter( msg => (!this.isValidConMsg(msg, cmType) || !this.isMessageInSync(msg)));
      const validMsgs = msgs.filter( msg =>
       (this.isValidConMsg(msg, cmType) && this.isMessageInSync(msg)));
       allOutOfSyncMsgs = allOutOfSyncMsgs.concat(outOfSyncMessages);
       allValidMsgs = allValidMsgs.concat(validMsgs);

    }
    this.pbftState.outOfSyncMessages = allOutOfSyncMsgs;
    for (const msg of allValidMsgs) {
       this.utils.logger.debug(`Validated out of sync message ${JSON.stringify(msg)}`);
       this.updateEvidence(msg);
     }

  }

  /**
   * Enter Prepared stage- update state, broadcast a Commit message to the committee.
   */
  @bind
  enterPrepared(): void {
    this.utils.logger.log(`Entering Prepared stage.`);
    this.pbftState.prepared = true;
    this.pbftState.progress = State.Prepared;
    const commitMsg: Message = { sender: this.nodeNumber, type: "ConsensusMessage" + "/" + ConsensusMessageType.Commit, conMsgType: ConsensusMessageType.Commit, view: this.pbftState.view, term: this.term, eBlockHash: this.pbftState.candidateEBlock.hash };
    this.multicastCommittee(commitMsg);
    this.handleCommitMessage(commitMsg);

  }

  /**
   * Handle Commit message. If valid, check if received 2f+1 messages needed to enter * Committed state.
   */
  @bind
  handleCommitMessage(msg: Message): void {
    this.recheckConMessages([ConsensusMessageType.PrePrepare, ConsensusMessageType.Prepare, ConsensusMessageType.Commit]); // check if maybe out of sync messages synced meanwhile
    if (this.isMessageFromFuture(msg)) {
      this.pbftState.outOfSyncMessages.push(msg);
      return;
    }
    if (!this.isValidConMsg(msg, ConsensusMessageType.Commit)) {
      return;
    }
    this.updateEvidence(msg);
    if (this.isValidByzMajorityVote(this.pbftState.blockProof.commits, this.cmap) && this.pbftState.prepared) {
      this.enterCommit();
    }

  }

  /**
   * Enter Committed state- update and propogate block proof along with corresponding * EncryptedBlock.
   */
  @bind
  enterCommit(): void {
    if (this.pbftState.committedLocal == true) return;
    this.utils.logger.log(`Entering commit stage`);
    this.pbftState.committedLocal = true;
    this.pbftState.progress = State.Committed;
    this.pbftState.blockProof.committed = true;
    this.propagateBP(this.pbftState.blockProof, this.pbftState.candidateEBlock);
  }

  /**
   * Propogate block proof in the form of a CommittedMessage, using fast block
   * propogation protocol (future)
   */
  @bind
  propagateBP(BP: BlockProof, EB: EncryptedBlock): void {
    const committedMsg: Message = {sender: this.nodeNumber, term: EB.term, type: "ConsensusMessage" + "/" + ConsensusMessageType.Committed, conMsgType: ConsensusMessageType.Committed, blockProof: BP, eBlock: EB, size_bytes: (this.utils.scenario.oaConfig.networkConfiguration.defaultMsgSizeBytes + this.utils.scenario.oaConfig.networkConfiguration.etxSizeBytes * this.utils.scenario.oaConfig.networkConfiguration.numEtxsPerBlock) };
    this.handleCommittedMessage(committedMsg);
  }

  @bind
  isValidCommittedMessage(msg: Message, fastSyncing: boolean = false): boolean {
    if (msg.eBlock.hash != msg.blockProof.hash) {
      this.utils.logger.warn(`Block hash ${msg.eBlock.hash} doesn't match block proof hash ${msg.blockProof.hash}`);
      return false;
    }
    if (msg.eBlock.term != msg.blockProof.term) {
      this.utils.logger.warn(`Block term ${msg.eBlock.term} doesn't match block proof term ${msg.blockProof.term}`);
      return false;
    }
    // if (!(msg.eBlock.term == this.term)) {
    //   if (msg.eBlock.term > this.term) {
    //     this.utils.logger.debug(`Out of sync, at term ${this.term}, received committed block (${msg.eBlock.term},${msg.eBlock.hash})`);
    //     // TODO handle node out of sync - we can use fast sync to validate message even if we aren't in sync
    //     // TODO if we are in sync is there reason to do full validation?
    //     if (!fastSyncing) return false;
    //   }
    //   else return false; // old message, ignore it
    // }

    // fast sync-  a correct node needs only to verify that all the signers appearing in BP are indeed committee members according to the header of corresponding EB
    const cmap = msg.eBlock.cmap;
    // TODO abstracting away some details- need to validate the messages themselves, not just the boolean arrays.
    if (!this.utils.isCommitteeMember(cmap, msg.eBlock.creator)) {
      this.utils.logger.warn(`Block creator ${msg.eBlock.creator} not in committee!`);
      return false;
    }
    if (!(this.isValidByzMajorityVote(msg.blockProof.prepares, cmap))) {
      this.utils.logger.warn(`Missing prepare messages!`);
      return false;
    }
    if (!(this.isValidByzMajorityVote(msg.blockProof.commits, cmap))) {
      this.utils.logger.warn(`Missing commit messages!`);
      return false;
    }
    if (!msg.blockProof.committed) {
      this.utils.logger.warn(`Block not committed!`);
      return false;
    }

    return true;
  }

  /**
   * Upon receiving a CommittedMessage, propogate the encrypted block and proof, RandomDelayAndPacketLoss
   * enter the decryption phase.
   */
  @bind
  handleCommittedMessage(msg: Message): void { // TODO separation between modules - decryptor
    // if (msg.eBlock.term == 4) {
    //     this.utils.logger.log(`Received EB+BP from ${msg.sender} for block (${msg.eBlock.term})`);
    // }
    if (!this.isValidCommittedMessage(msg)) {
        return;
    }
    // if (!this.decryptor.inDecryptingPhase(msg.eBlock.term)) {
    if (!this.decryptor.hasEBBP(msg.eBlock.term)) {
    // since node only enters phase once per term -> also send once
      this.utils.logger.log(`Received EB+BP from ${msg.sender} for block (${msg.eBlock.term})`);
      this.netInterface.fastcast(msg);
      this.decryptor.enterDecryptStage(msg.eBlock);
    }
  }

  @bind
  createBlock(eBlock: EncryptedBlock, dBlock: DecryptedBlock, blockProof: BlockProof, blockShares: BlockShare[]): Block {
    const block: Block = { term: eBlock.term, encryptedBlock: eBlock, decryptedBlock: dBlock, blockProof: blockProof, blockShares: blockShares };
    return block;
  }


  @bind
  handleNewBlock(block: Block, inSyncMode: boolean = false): void {
    this.blockchain.addBlock(block);
    this.utils.logger.debug(`Added block ${JSON.stringify(block)} to blockchain...`);
    this.enterNewTerm(block.decryptedBlock, inSyncMode);
  }

  @bind
  handleProposalExpiredTimeout(): void {
    this.utils.logger.log(`Timeout expired for current proposal (term = ${this.term}, view = ${this.pbftState.view})!`);
    this.enterNewView();

  }

  /**
   * At start of each term/view, node should collect viewchange messages if it
   * is designated as the next leader in the next view.
   */
  @bind
  setCollectingViewChanges(): void {
    this.pbftState.collectingViewChangeMsgs = this.utils.isLeader(this.cmap, this.nodeNumber, this.pbftState.view + 1);
    if (this.pbftState.collectingViewChangeMsgs) this.utils.logger.debug(`Collecting view change messages...`);
  }

  @bind
  enterNewView(): void {
    this.timer.setProposalTimer(Math.pow(2, this.pbftState.view) * PROPOSAL_TIMER_MS);
    let proposal: Proposal = undefined;
    // if proposal already reached Prepared state, send the evidence and proposed
    // block as part of the view change message.
    if (this.pbftState.prepared) {
      if (!this.isValidByzMajorityVote(this.pbftState.blockProof.prepares, this.cmap)) this.utils.logger.error(`In prepared state but don't have 2f+1 prepare messages!`);
      proposal = { term: this.term, view: this.pbftState.view, candidateEBlock: this.pbftState.candidateEBlock, prepMessages: this.pbftState.prepMessages };
    }
    // update view, move to next leader
    this.pbftState.view += 1;
    this.utils.logger.log(`Entering new view ${this.pbftState.view}`);
    const nextLeader = this.utils.getLeader(this.cmap, this.pbftState.view);
    this.pbftState.viewChangeMessages.map(item => item ? (item.view == this.pbftState.view) : false ); // initialize viewchange messages for new view.
    this.utils.logger.debug(`View change messages are ${JSON.stringify(this.pbftState.viewChangeMessages)}`);
    const viewChangeMessage: Message = { sender: this.nodeNumber, receipient: nextLeader, type: "ConsensusMessage" + "/" + ConsensusMessageType.ViewChange, conMsgType: ConsensusMessageType.ViewChange, term: this.term, view: this.pbftState.view, proposal: proposal, size_bytes: (proposal ? this.utils.scenario.oaConfig.networkConfiguration.etxSizeBytes * (this.utils.scenario.oaConfig.networkConfiguration.numEtxsPerBlock) :  this.utils.scenario.oaConfig.networkConfiguration.defaultMsgSizeBytes) };
    if (!this.utils.isLeader(this.cmap, this.nodeNumber, this.pbftState.view)) {
      this.utils.logger.debug(`unicasting to leader ${nextLeader}...`);
      this.netInterface.unicast(nextLeader, viewChangeMessage);
      this.setCollectingViewChanges(); // next leader should be ready if this new view fails.
    }
    else {
      this.handleViewChangeMessage(viewChangeMessage); // I'm the new leader, don't need to unicast message to myself
    }

  }

  @bind
  countValidMessages(msgs: Message[], validatorFn: (msg: Message) => boolean): number {
    const validMessages = msgs.filter(m => m ? validatorFn(m) : false);
    return validMessages.length;
  }

  @bind
  isValidProposalPrepareMessage(msg: Message, eBlock: EncryptedBlock): boolean {
    if (!this.isValidMessageType(msg, ConsensusMessageType.Prepare)) return false;
    if (!this.isValidCommitteeMessage(msg)) return false;

    if (!this.pbftState.candidateEBlock) {
      this.utils.logger.debug(`Receieved ${JSON.stringify(msg)}, but have no candidate EB!`);
      return false;
    }
    if (msg.eBlockHash != eBlock.hash) {
      this.utils.logger.debug(`Invalid Prepare message, hash (${msg.eBlockHash}) doesn't match proposal hash ${eBlock.hash}, msg=${JSON.stringify(msg)}`);
      return false;
    }

    if ((msg.view != eBlock.view) || (msg.term != eBlock.term)) {
      this.utils.logger.debug(`Invalid Prepare message ${JSON.stringify(msg)}, term and view don't match proposed EB (${eBlock.term},${eBlock.view})`);
      return false;
    }
    return true;
  }


  @bind
  isValidViewChangeMessage(msg: Message): boolean {
    if (!this.isValidMessageType(msg, ConsensusMessageType.ViewChange)) return false;
    // check I'm in sync i.e the following two hold:
    // 1. on same term as sender of view change msg
    // 2. on either same view or one behind.
    if (!this.isMessageInSync(msg)) {
      this.utils.logger.debug(`VC message out of sync.`);
      return false; // TODO syncer should handle if needed?
    }
    if (!this.isValidCommitteeMessage(msg)) {
      this.utils.logger.debug(`invalid committee message}`);
      return false;
    }
    if (!this.utils.isLeader(this.cmap, msg.receipient, msg.view)) {
      this.utils.logger.debug(`${msg.receipient} Not leader for new view}`);
      return false;
    }

    // validate proposal
    if (!msg.proposal) return true; // no proposal in the view change message, this is ok
    // if there is a proposal based on 2f+1 prepare messages, we need to validate it and the prepare messages
    if ((msg.proposal.term != msg.term) || (msg.proposal.view != msg.proposal.candidateEBlock.view)) {
      this.utils.logger.debug(`Invalid proposal`);
      return false;
    }
    if (!this.isValidEncryptedBlock(msg.proposal.candidateEBlock)) {
      this.utils.logger.debug(`Invalid EB`);
      return false;
    }
    const validPrepMessages = msg.proposal.prepMessages.filter( m => m ? this.isValidProposalPrepareMessage(m, msg.proposal.candidateEBlock) : false);
    if (!this.utils.isByzMaj(validPrepMessages.length)) {
      this.utils.logger.debug(`Invalid prepare messages, there should be at least ${2 * this.utils.numByz + 1} - only have ${validPrepMessages.length} valid messages`);
      return false;
    }

    return true;

  }

  @bind
  isValidNewViewMessage(msg: Message): boolean {
    if (!this.isValidMessageType(msg, ConsensusMessageType.NewView)) return false;
    // Check the message is from the correct leader
    if (!this.utils.isLeader(this.cmap, msg.sender, msg.view)) {
      this.utils.logger.warn(`Received NewView message from ${msg.sender}, expected from ${this.cmap[msg.view]}`);
      return false;
    }
    if (!this.isMessageInSync(msg)) return false;
    if (!this.isValidCommitteeMessage(msg)) return false;
    const numValidVCmsgs = this.countValidMessages(msg.viewChangeMsgs, this.isValidViewChangeMessage);
    this.utils.logger.debug(`Validating view-change messages...`);
    if (!this.utils.isByzMaj(numValidVCmsgs)) {
      this.utils.logger.warn(`there should be at least ${this.utils.numByz * 2 + 1} view change messages - only have ${numValidVCmsgs} valid messages`);
      this.utils.logger.debug(`VC msgs = ${JSON.stringify(msg.viewChangeMsgs)}`);
      return false;
    }
    // if the view change messages are valid, make sure to update node view before validating the pre-prepare message
    // which is set to new view. TODO assuming here all views are identical across the messages
    this.pbftState.view = msg.viewChangeMsgs.filter(m => m ? true : false)[0].view;
    this.utils.logger.debug(`Validating pre-prepare message...`);
    if (!this.isValidPrePrepareMessage(msg.newPrePrepMsg, true)) {
      this.utils.logger.warn(`Invalid pre-prepare message ${JSON.stringify(msg.newPrePrepMsg)}`);
      return false;
    }
    return true;

  }

  @bind
  handleViewChangeMessage(msg: Message): void {
    if (!this.pbftState.collectingViewChangeMsgs) {
      if (this.utils.isLeader(this.cmap, this.nodeNumber, this.pbftState.view) || this.utils.isLeader(this.cmap, this.nodeNumber, this.pbftState.view + 1)) return;
      else this.utils.logger.warn(`${msg.sender} thinks I'm new leader, but according to my state the new leader should be ${this.utils.getLeader(this.cmap, this.pbftState.view)} or ${this.utils.getLeader(this.cmap, this.pbftState.view + 1)}`);
      return;
    }
    if (!this.isValidViewChangeMessage(msg)) {
      this.utils.logger.debug(`Rejected ViewChange message ${JSON.stringify(msg)}`);
      return;
    }
    this.utils.logger.debug(`Accepted ViewChange message ${JSON.stringify(msg)}`);
    this.updateEvidence(msg);
    if (this.isValidByzMajorityVote(this.pbftState.viewChangeMessages, this.cmap)) {
        this.enterPrimaryChangeTakeover();
    }

  }

  @bind
  getMaximalViewProposalMsg(vcMsgs: Message[]): Message {
    // if there exists a non-null proposal, return the one with maximum views
    // otherwise, return the maximal view among all messages
    let maxViewPropMsg: Message = undefined;
    let maxViewMsg: Message = undefined;
    for (const propMsg of vcMsgs.filter( item => item ? item : false ) ) { // take only defined messages (ignore nulls)
      if (propMsg.proposal) {
        if (!maxViewPropMsg || propMsg.proposal.view > maxViewPropMsg.view) {
          maxViewPropMsg = propMsg;
        }

      }
      if (!maxViewMsg || maxViewMsg.view < propMsg.view) maxViewMsg = propMsg;

    }
    if (maxViewPropMsg) return maxViewPropMsg;
    else return maxViewMsg;
  }

  @bind
  enterPrimaryChangeTakeover() {
    this.utils.logger.log(`Received ${this.countValidVotes(this.pbftState.viewChangeMessages, this.cmap)} votes, needed  ${this.utils.numByz * 2 + 1}, assuming role as primary for view ${this.pbftState.view}.`);
    const vcMsgs: Message[] = this.pbftState.viewChangeMessages; // TODO make sure deep copy or will be erased when new view entered
    this.pbftState.collectingViewChangeMsgs = false; // TODO currently this means that if the next leader received 2f+1
    // messages before his own timeout expires, his own view change message will not be handled

    const maxPropMsg: Message = this.getMaximalViewProposalMsg(vcMsgs);
    if (!(this.pbftState.view == maxPropMsg.view)) {
      if (this.pbftState.view + 1 == maxPropMsg.view) this.enterNewView();
      else {
        this.utils.logger.error(`Not in sync: Maximum view proposal is ${maxPropMsg.view}, I'm at ${this.pbftState.view}`);
      }
    }
    if (!maxPropMsg.proposal) {
      this.pbftState.candidateEBlock = this.createNewEBlock();
    }
    else {
      // if (maxProp.view != this.pbftState.view) {
      //   this.utils.logger.error(`Not in sync: Maximum view proposal is ${maxProp.view}, I'm at ${this.pbftState.view}`);
      // }
      this.pbftState.candidateEBlock = maxPropMsg.proposal.candidateEBlock;
    }
    const prePrepMsg: Message = { sender: this.nodeNumber, type: "ConsensusMessage" + "/" + ConsensusMessageType.PrePrepare, conMsgType: ConsensusMessageType.PrePrepare, term: this.term, view: this.pbftState.view, eBlock: this.pbftState.candidateEBlock };
    const newViewMsg: Message = { sender: this.nodeNumber, type: "ConsensusMessage" + "/" + ConsensusMessageType.NewView, conMsgType: ConsensusMessageType.NewView, term: this.term, view: this.pbftState.view, viewChangeMsgs: vcMsgs, newPrePrepMsg: prePrepMsg, size_bytes: (this.utils.scenario.oaConfig.networkConfiguration.numEtxsPerBlock * this.utils.scenario.oaConfig.networkConfiguration.etxSizeBytes + this.utils.scenario.oaConfig.networkConfiguration.defaultMsgSizeBytes) };
    this.multicastCommittee(newViewMsg);
    this.handleNewViewMessage(newViewMsg); // "sending the message to ourselves" since handling is identical

  }


  @bind
  handleNewViewMessage(msg: Message): void {
    this.utils.logger.debug(`Received new view message ${JSON.stringify(msg)}, validating it...`);
    if (!this.isValidNewViewMessage(msg)) {
      return;
    }
    // if ( [this.pbftState.view, (this.pbftState.view + 1) ].indexOf(msg.view) == -1 ) {
    //   this.utils.logger.error(`Out of sync: NewView message view is ${msg.view}, I'm at ${this.pbftState.view}.`);
    // }
    this.updateEvidence(msg);
    if (!this.getMaximalViewProposalMsg(msg.viewChangeMsgs).proposal) { // means that a new block was created, treat this as a new pbft round initialized by the attached pre-prepare message
      this.utils.logger.log(`Received new view message from ${msg.sender} with a newly created block, starting new round at view ${msg.view}`);
      this.initPBFT_State();
      this.pbftState.view = msg.view;
      this.handlePrePrepareMessage(msg.newPrePrepMsg);
    }
    else { // means an existing block proposal received 2f+1 prepare messages
      if (this.pbftState.view != msg.view) { // TODO unify with primary change code
        if (this.pbftState.view == (msg.view - 1) ) { // haven't changed view yet, do so now to match new view
          this.enterNewView();
        }
        else {
          this.utils.logger.error(`Not in sync: Maximum view proposal is ${msg.view}, I'm at ${this.pbftState.view}`);
        }

      }
      this.pbftState.candidateEBlock = msg.newPrePrepMsg.eBlock; // there are 2f+1 votes for this block, so it should be the candidate for the prepare phase
      this.enterPrepared();

    }



  }







}
