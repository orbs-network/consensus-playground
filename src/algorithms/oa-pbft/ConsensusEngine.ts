import * as _ from "lodash";
import { Message, Cmap, Utils, Block, EncryptedBlock, DecryptedBlock, BlockProof, ConsensusMessageType, Proposal } from "./common";
import * as Common from "./common";
//import Logger from "../../simulation/Logger";
import { Blockchain } from "./Blockchain";
import { Decryptor } from "./Decryptor";
import { Mempool } from "./Mempool";
import { Timer } from "./Timer";
import { NetworkInterface } from "./NetworkInterface";


import bind from "bind-decorator";

const PROPOSAL_TIMER_MS = 2000;

enum Phase { // not used yet
    Agreeing,
    Waiting,
    Decrypting
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
}



export class ConsensusEngine {
  protected nodeNumber: number;
  protected numNodes: number;
  protected decryptor: Decryptor;
  protected blockchain: Blockchain;
  protected mempool: Mempool;
  protected netInterface: NetworkInterface;
  protected timer: Timer;
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

    this.phase = undefined;
    this.term = 0;
    this.utils = utils;
    this.initPBFT_State();


  }

  @bind
  getTerm(): number {
    return this.term;
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
  initConsensus(numNodes: number, committeeSize: number, numByz: number): void {
    this.utils.numNodes = numNodes;
    this.utils.committeeSize = committeeSize;
    this.utils.numByz = numByz;
    const lastDecryptedBlock = this.blockchain.getLastBlock().decryptedBlock;
    this.enterNewTerm(lastDecryptedBlock);
  }

 /**
  * Begin new instance of PBFT for a new block-height, with the new committee set  according to the last decrypted block.
  * @param lastDBlock - The decrypted block of the previous round
  */
  @bind
  enterNewTerm(lastDBlock: DecryptedBlock): void {

    this.cmap = this.sortition(lastDBlock);
    this.initPBFT_State();
    this.term += 1;
    this.timer.setProposalTimer(PROPOSAL_TIMER_MS);
    this.utils.logger.log(`Entering term ${this.term}, committee is ${this.utils.getCommittee(this.cmap)}`);
    this.setCollectingViewChanges();
    if (this.utils.isLeader(this.cmap, this.nodeNumber, this.pbftState.view)) {
      this.utils.logger.log(`Chosen as leader`);
      this.phase = Phase.Agreeing;
      const eBlock: EncryptedBlock = this.createNewEBlock();
      // this.pbftState.candidateEBlock = eBlock;
      const prePrepMsg: Message = { sender: this.nodeNumber, type: "ConsensusMessage" + "/" + ConsensusMessageType.PrePrepare, conMsgType: ConsensusMessageType.PrePrepare, term: this.term, view: this.pbftState.view, eBlock: eBlock, eBlockHash: eBlock.hash };
      this.multicastCommittee(prePrepMsg);
      this.handlePrePrepareMessage(prePrepMsg); // "sending the message to ourselves" since handling is identical

    }
    else {
      this.phase = Phase.Waiting;
      this.recheckConMessages([ConsensusMessageType.PrePrepare, ConsensusMessageType.Prepare, ConsensusMessageType.Commit]); // sync on messages from previous term
    }

  }

  @bind
  initPBFT_State(): void {
    if (this.pbftState) this.utils.logger.debug(`Initializing PBFT state, out of sync messages are ${JSON.stringify(this.pbftState.outOfSyncMessages)}`);
    const futureMsgs = (this.pbftState) ? this.pbftState.outOfSyncMessages.filter( msg => (msg.term >= this.term) ) : [] ;
    const newViewMsgs = (this.pbftState) ? this.pbftState.newViewMessages.filter( msg => (msg.term >= this.term) ) : [] ;
    this.utils.logger.debug(`Initializing PBFT state, future messages are ${JSON.stringify(futureMsgs)}`);
    this.utils.logger.debug(`Initializing PBFT state, newView messages are ${JSON.stringify(newViewMsgs)}`);
    this.pbftState = { view: 1, candidateEBlock: undefined, outOfSyncMessages: futureMsgs, prepMessages: [], commitMessages: [], prepared: false, committedLocal: false, blockProof: this.createNewBP(), viewChangeMessages: new Array(this.utils.numNodes).fill(undefined), collectingViewChangeMsgs: false, newViewMessages: newViewMsgs };

  }

  @bind
  multicastCommittee(msg: Message): void { 
    this.netInterface.multicast(this.utils.getCommittee(this.cmap), msg);
  }

/**
 * Check if message is in sync with node's current state - on same term and view, and
 * that if the message is a prepare or commit message, the corresponding pre-prepare message has already been seen.
 * @param message - Some ConsensusMessage
 */
  @bind
  isInSyncMessage(msg: Message): boolean {
    if (msg.term < this.term) return false; // ignore messages from the past
    if ( (msg.term > this.term) || !(msg.view == this.pbftState.view) ) {
      this.utils.logger.debug(`Received message with term ${msg.term}, expected ${this.term}, and with view ${msg.view}, expected ${this.pbftState.view}.`);
      this.utils.logger.debug(`Message is ${JSON.stringify(msg)}`);
      return false;
    }

    if ( (msg.conMsgType != ConsensusMessageType.PrePrepare) && !this.pbftState.candidateEBlock) {
      this.utils.logger.debug(`Receieved ${JSON.stringify(msg)}, but have no candidate EB!`);
      return false;
    }
    return true;
  }


  @bind
  isValidEBlock(eBlockHash: string): boolean {
    if (eBlockHash != this.pbftState.candidateEBlock.hash) {
      this.utils.logger.debug(`Mismatching hash- receieved ${eBlockHash}, expected ${this.pbftState.candidateEBlock.hash}`);
      return false;
    }
    // to avoid boilerplate- assuming that eblock content matches hash TODO can add
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
    const eBlock: EncryptedBlock = { term: this.term, content: randomContent, hash: contentHash, lastEBlockHash: this.blockchain.getLastBlock().encryptedBlock.hash, lastDBlockHash: this.blockchain.getLastBlock().decryptedBlock.hash, creator: this.nodeNumber, cmap: this.cmap };
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
  countValidVotes(voteArr: any[]): number {
    let count = 0;
    for (let i = 0; i < voteArr.length; i++) {
      if (voteArr[i]) {
        if (this.utils.isCommitteeMember(this.cmap, i + 1)) {
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
   * @return {number} - number of true/existing objects is returned
   */
  @bind
  isValidByzMajorityVote(voteArr: any[]): boolean { // any to allow use with arrays of objects as well
    return Utils.isAByzMajOfB(this.countValidVotes(voteArr), this.utils.committeeSize);
  }
  /**
   * Check if a message is a valid ConsensusMessage of the desired type.
   */
  @bind
  isValidConMsg(msg: Message, conMsgType: ConsensusMessageType): boolean {
    if (!(conMsgType == ConsensusMessageType.Prepare || conMsgType == ConsensusMessageType.PrePrepare || conMsgType == ConsensusMessageType.Commit)) {
      this.utils.logger.error(`Currently supporting only Preprepare, Prepared and Commit type messages`);
      return false;
    }
    if (!this.utils.isCommitteeMember(this.cmap, msg.sender) && this.isInSyncMessage(msg) ) { // TODO will be accepted if message not in sync?
      this.utils.logger.warn(`Got message from non-committee member ${msg.sender}, committee is ${this.utils.getCommittee(this.cmap)}. Message = ${JSON.stringify(msg)}`);
      return false;
    }

    if (!this.utils.isCommitteeMember(this.cmap, this.utils.nodeNumber) && this.isInSyncMessage(msg)) {
      this.utils.logger.warn(`Received message but I'm not a committee member`);
      return false;
    }


    if (msg.conMsgType != conMsgType) {
      this.utils.logger.debug(`Expected message of type ${conMsgType}, got message of type ${msg.conMsgType}`);
      return false;
    }
    const ebHash = (conMsgType == ConsensusMessageType.PrePrepare) ? msg.eBlock.hash : msg.eBlockHash;
    if (this.pbftState.candidateEBlock && !this.isValidEBlock(ebHash)) {
      this.utils.logger.debug(`Invalid Eblock (${ebHash}), msg=${JSON.stringify(msg)}`);
      return false;
    }

    return true;
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
    // TODO validation should move to separate function and use isValidConMsg
    if (!this.isInSyncMessage(msg)) {
      this.pbftState.outOfSyncMessages.push(msg);
      return;
    }
    // if in sync, we shouldn't receive more than 1 preprepare message for this term
    if (this.pbftState.candidateEBlock) {
      this.utils.logger.warn(`Received preprepare message ${JSON.stringify(msg)}, already received one for current view ${this.pbftState.view} with block (${this.pbftState.candidateEBlock.term},${this.pbftState.candidateEBlock.hash})`);
      return;
    }
    // if view > 1, make sure the preprepare message is identical to that in the NewView message
    // TODO need to validate creator as well
    if (this.pbftState.view > 1) {
      if (this.pbftState.newViewMessages.length < (this.pbftState.view - 1) ) { // assuming all new view messages receieved
        this.utils.logger.error(`Didn't receive NewView message corresponding to ${JSON.stringify(msg)}, new view messages are ${JSON.stringify(this.pbftState.newViewMessages)}`);
      } // - 2 since (1) view is 1-indexed while array is 0-indexed, and (2) we want to check previous new view message
      else if (!Utils.areMessagesEqual(this.pbftState.newViewMessages[this.pbftState.view - 1 - 1].newPrePrepMsg, msg)) {
        this.utils.logger.error(`Preprepare message ${JSON.stringify(msg)} doesn't correspond to NewView message ${JSON.stringify(this.pbftState.newViewMessages[this.pbftState.view - 1 - 1].newPrePrepMsg)}`);
      }
    }
    else { // check creator matches leader of first view
      if (!this.utils.isLeader(this.cmap, msg.eBlock.creator, this.pbftState.view)) {
        this.utils.logger.warn(`Received pre-prepare EB created by ${msg.eBlock.creator}, expected from ${this.cmap[this.pbftState.view]}`);
        return;
      }
    }

    if (!this.utils.isLeader(this.cmap, msg.sender, this.pbftState.view)) {
      this.utils.logger.warn(`Received pre-prepare message from ${msg.sender}, expected from ${this.cmap[this.pbftState.view]}`);
      return;
    }



    if (!this.isRepresentativeEBlock(msg.eBlock)) {
      return;
    }

    if (!Utils.areCmapsEqual(this.cmap, msg.eBlock.cmap)) {
      this.utils.logger.warn(`Locally computed cmap ${this.cmap} different than cmap ${msg.eBlock.cmap} received in block!`);
      return;
    }

    if (!this.utils.isCommitteeMember(this.cmap, this.utils.nodeNumber) && this.isInSyncMessage(msg)) {
      this.utils.logger.warn(`Received message but I'm not a committee member`);
      return;
    }

    if ((this.blockchain.getLastBlock().encryptedBlock.hash != msg.eBlock.lastEBlockHash) || (this.blockchain.getLastBlock().decryptedBlock.hash != msg.eBlock.lastDBlockHash)) {
      this.utils.logger.warn(`Received EB with pointer ${msg.eBlock.lastEBlockHash} to last EB and pointer ${msg.eBlock.lastDBlockHash} to last DB, but mine are ${this.blockchain.getLastBlock().encryptedBlock.hash} and ${this.blockchain.getLastBlock().decryptedBlock.hash}`);
      return;
    }






    this.utils.logger.debug(`Received pre-prepare message for block (${msg.eBlock.term},${msg.eBlock.hash}) from ${msg.sender}`);
    this.pbftState.candidateEBlock = msg.eBlock;

    const prepareMsg: Message = { sender: this.nodeNumber, type: "ConsensusMessage" + "/" + ConsensusMessageType.Prepare, conMsgType: ConsensusMessageType.Prepare, term: this.term, view: this.pbftState.view, eBlockHash: msg.eBlock.hash };
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
    if (!this.isInSyncMessage(msg)) { // TODO future- could be handled by syncing mechanism?
      this.pbftState.outOfSyncMessages.push(msg);
      return;
    }
    if (!this.isValidConMsg(msg, ConsensusMessageType.Prepare)) {
      return;
    }
    this.updateEvidence(msg);
    this.utils.logger.debug(`Received ${this.countValidVotes(this.pbftState.blockProof.prepares)} votes out of ${this.pbftState.blockProof.prepares.length}, is ${this.pbftState.blockProof.prepares}, out of sync messages are ${JSON.stringify(this.pbftState.outOfSyncMessages)}`);
    if (this.isValidByzMajorityVote(this.pbftState.blockProof.prepares) && this.pbftState.candidateEBlock && !this.pbftState.prepared) {
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
      const outOfSyncMessages = msgs.filter( msg => (!this.isValidConMsg(msg, cmType) || !this.isInSyncMessage(msg)));
      const validMsgs = msgs.filter( msg =>
       (this.isValidConMsg(msg, cmType) && this.isInSyncMessage(msg)));
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
    if (!this.isInSyncMessage(msg)) {
      this.pbftState.outOfSyncMessages.push(msg);
      return;
    }
    if (!this.isValidConMsg(msg, ConsensusMessageType.Commit)) {
      return;
    }
    this.updateEvidence(msg);
    if (this.isValidByzMajorityVote(this.pbftState.blockProof.commits) && this.pbftState.prepared) {
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
    this.pbftState.blockProof.committed = true;
    this.propagateBP(this.pbftState.blockProof, this.pbftState.candidateEBlock);
  }

  /**
   * Propogate block proof in the form of a CommittedMessage, using fast block
   * propogation protocol (future)
   */
  @bind
  propagateBP(BP: BlockProof, EB: EncryptedBlock): void {
    const committedMsg: Message = {sender: this.nodeNumber, type: "ConsensusMessage" + "/" + ConsensusMessageType.Committed, conMsgType: ConsensusMessageType.Committed, blockProof: BP, eBlock: EB };
    //this.netInterface.broadcast(committedMsg); // TODO replace with fast propagation protocol - duplicate propagation - also in - handleCommittedMessage -> removed here 
    this.handleCommittedMessage(committedMsg);
  }

  @bind
  isValidCommittedMessage(msg: Message): boolean {
    if (!(msg.eBlock.term == this.term)) {
      // TODO handle node out of sync
      if (msg.eBlock.term > this.term) this.utils.logger.warn(`Out of sync, at term ${this.term}, received committed block at term ${msg.eBlock.term}`);
      return false;
    }
    if (!(Utils.areCmapsEqual(msg.eBlock.cmap, this.cmap))) {
      this.utils.logger.warn(`Cmap mismatch, got ${msg.eBlock.cmap}, expected ${this.cmap}`);
      return false;
    }
    if (!this.utils.isCommitteeMember(this.cmap, msg.eBlock.creator)) {
      this.utils.logger.warn(`Block creator ${msg.eBlock.creator} not in committee!`);
      return false;
    }
    if (!(this.isValidByzMajorityVote(msg.blockProof.prepares))) {
      this.utils.logger.warn(`Missing prepare messages!`);
      return false;
    }
    if (!(this.isValidByzMajorityVote(msg.blockProof.commits))) {
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
    if (!this.isValidCommittedMessage(msg)) {
      return;
    }
    if (!this.decryptor.inDecryptingPhase()){
      this.netInterface.fastcast(msg); // TODO replace with fast propagation protocol
      this.decryptor.enterDecryptStage(msg.eBlock); 
    }
  }

  @bind
  createBlock(eBlock: EncryptedBlock, dBlock: DecryptedBlock, blockProof: BlockProof): Block {
    const block: Block = { term: eBlock.term, encryptedBlock: eBlock, decryptedBlock: dBlock, blockProof: blockProof };

    return block;
  }

  /**
   * Triggered by the Decryptor component upon completion of the block decryption.
   * New block can be added to block chain and a new term entered.
   */
  @bind
  handleBlockDecrypted(dBlock: DecryptedBlock, eBlock: EncryptedBlock): void {
    this.utils.logger.log(`Block ${eBlock.term} decrypted, entering new term.`);
    this.blockchain.addBlock(this.createBlock(eBlock, dBlock, this.pbftState.blockProof));
    this.enterNewTerm(dBlock);
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
      if (!this.isValidByzMajorityVote(this.pbftState.blockProof.prepares)) this.utils.logger.error(`In prepared state but don't have 2f+1 prepare messages!`);
      proposal = { term: this.term, view: this.pbftState.view, candidateEBlock: this.pbftState.candidateEBlock, prepMessages: this.pbftState.prepMessages };
    }
    // update view, move to next leader
    this.pbftState.view += 1;
    this.utils.logger.log(`Entering new view ${this.pbftState.view}`);
    const nextLeader = this.utils.getLeader(this.cmap, this.pbftState.view);
    this.pbftState.viewChangeMessages.map(item => item ? (item.view == this.pbftState.view) : false ); // initialize viewchange messages for new view.
    this.utils.logger.debug(`View change messages are ${JSON.stringify(this.pbftState.viewChangeMessages)}`);
    const viewChangeMessage: Message = { sender: this.nodeNumber, type: "ConsensusMessage" + "/" + ConsensusMessageType.ViewChange, conMsgType: ConsensusMessageType.ViewChange, term: this.term, view: this.pbftState.view, proposal: proposal };
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
  isValidViewChangeMessage(msg: Message): boolean {
    // if () {
    //   // TODO check prepare messages, this proves validity
    //   return false;
    // }
    return true;

  }

  @bind
  handleViewChangeMessage(msg: Message): void {
    // TODO validate message- check from committee, that prepares match the EB
    if (!this.isValidViewChangeMessage(msg)) {
      this.utils.logger.warn(`Invalid view change message! ${JSON.stringify(msg)}`);
    }
    if (!this.pbftState.collectingViewChangeMsgs) {
      if (this.utils.isLeader(this.cmap, this.utils.nodeNumber, this.pbftState.view) || this.utils.isLeader(this.cmap, this.utils.nodeNumber, this.pbftState.view + 1)) return;
      else this.utils.logger.warn(`${msg.sender} thinks I'm new leader, but according to my state the new leader should be ${this.utils.getLeader(this.cmap, this.pbftState.view)} or ${this.utils.getLeader(this.cmap, this.pbftState.view + 1)}`);
      return;
    }

    // check I'm in sync i.e the following two hold:
    // 1. on same term as sender of view change msg
    // 2. on either same view or one behind.
    if (this.pbftState.view > (msg.view + 1) || (this.term > msg.term) ) return; // ignore messages from previous terms or 2 views back or more
    if ( (this.term < msg.term) || ((this.pbftState.view + 1) < msg.view )) {
      this.utils.logger.warn(`Out of sync: getting messages with term,view (${msg.term},${msg.view}) but I'm at (${this.term},${this.pbftState.view})`);
      // TODO need to sync?
      return;
    }

    this.utils.logger.debug(`Accepted ViewChange message ${JSON.stringify(msg)}`);
    this.updateEvidence(msg);
    if (this.isValidByzMajorityVote(this.pbftState.viewChangeMessages)) {
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
    this.utils.logger.log(`Received majority of ${this.countValidVotes(this.pbftState.viewChangeMessages)} votes out of ${this.utils.committeeSize}, assuming role as primary for view ${this.pbftState.view}.`);
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
    const newViewMsg: Message = { sender: this.nodeNumber, type: "ConsensusMessage" + "/" + ConsensusMessageType.NewView, conMsgType: ConsensusMessageType.NewView, term: this.term, view: this.pbftState.view, viewChangeMsgs: vcMsgs, newPrePrepMsg: prePrepMsg };
    this.multicastCommittee(newViewMsg);
    this.handleNewViewMessage(newViewMsg); // "sending the message to ourselves" since handling is identical

  }

  @bind
  handleNewViewMessage(msg: Message): void {
    // TODO check validity of new view message
    if ( [this.pbftState.view, (this.pbftState.view + 1) ].indexOf(msg.view) == -1 ) {
      this.utils.logger.error(`Out of sync: NewView message view is ${msg.view}, I'm at ${this.pbftState.view}.`);
    }
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

  @bind
  isSleeping(): boolean {
    return this.sleeping;
  }

  @bind
  handleSleepTimeoutExpired(): void {
    this.utils.logger.log(`Waking up!`);
    this.sleeping = false;
  }




}
