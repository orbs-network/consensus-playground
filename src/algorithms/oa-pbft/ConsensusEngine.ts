import * as _ from "lodash";
import { Message, Cmap, Utils, Block, EncryptedBlock, DecryptedBlock, BlockProof, ConsensusMessageType } from "./common";
import * as Common from "./common";
import Logger from "../../simulation/Logger";
import { Blockchain } from "./Blockchain";
import { Decryptor } from "./Decryptor";
import { Mempool } from "./Mempool";
import { NetworkInterface } from "./NetworkInterface";


import bind from "bind-decorator";

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
}

export class ConsensusEngine {
  protected nodeNumber: number;
  protected numNodes: number;
  protected decryptor: Decryptor;
  protected blockchain: Blockchain;
  protected mempool: Mempool;
  protected netInterface: NetworkInterface;

  protected cmap: Cmap;
  protected term: number;
  protected phase: Phase;
  protected pbftState: PBFTState;

  protected logger: Logger;
  protected utils: Utils;

  constructor(nodeNumber: number, decryptor: Decryptor, blockchain: Blockchain, mempool: Mempool, netInterface: NetworkInterface, utils: Utils, logger: Logger = undefined) {
    this.nodeNumber = nodeNumber;
    this.decryptor = decryptor;
    this.blockchain = blockchain;
    this.mempool = mempool;
    this.netInterface = netInterface;

    this.phase = undefined;
    this.term = 0;
    this.logger = logger;
    this.utils = utils;
    this.initPBFT_State();


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
  * TODO in the future this should contain more detailed information about each node * and not just numbers
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
  * Begin new instance of PBFT for a new block-height, with the a new committee set  according to the last decrypted block.
  * @param lastDBlock - The decrypted block of the previous round
  */
  @bind
  enterNewTerm(lastDBlock: DecryptedBlock): void {

    this.cmap = this.sortition(lastDBlock);
    this.initPBFT_State();
    this.term += 1;

    this.logger.log(`Entering term ${this.term}`);
    if (this.utils.isLeader(this.cmap, this.nodeNumber)) {
      // TODO set timeout?
      this.logger.log(`Chosen as leader, committee is ${this.utils.getCommittee(this.cmap)}`);
      this.phase = Phase.Agreeing;
      const eBlock: EncryptedBlock = this.createNewEBlock();
      this.pbftState.candidateEBlock = eBlock;
      const prePrepMsg: Message = { sender: this.nodeNumber, type: "ConsensusMessage", conMsgType: ConsensusMessageType.PrePrepare, term: this.term, view: this.pbftState.view, eBlock: eBlock };
      this.broadcastCommittee(prePrepMsg);
      this.handlePrePrepareMessage(prePrepMsg); // "sending the message to ourselves" since handling is identical

    }
    else {
      this.phase = Phase.Waiting;
      this.recheckConMessages([ConsensusMessageType.PrePrepare]); //
    }

  }

  @bind
  initPBFT_State(): void {
    if (this.pbftState) this.logger.debug(`Initializing PBFT state, out of sync messages are ${JSON.stringify(this.pbftState.outOfSyncMessages)}`);
    const futureMsgs = (this.pbftState) ? this.pbftState.outOfSyncMessages.filter( msg => msg.term > this.term) : [] ;
    this.logger.debug(`Initializing PBFT state, future messages are ${JSON.stringify(futureMsgs)}`);
    this.pbftState = { view: 1, candidateEBlock: undefined, outOfSyncMessages: futureMsgs, prepMessages: [], commitMessages: [], prepared: false, committedLocal: false, blockProof: this.createNewBP() };

  }

  @bind
  broadcastCommittee(msg: Message): void {
    for ( const member of this.utils.getCommittee(this.cmap) ) {
      this.netInterface.unicast(member, msg);
    }
  }

  @bind
  isInSyncMessage(msg: Message): boolean {
    if (msg.term < this.term) return false; // ignore messages from the past
    if ( (msg.term > this.term) || !(msg.view == this.pbftState.view) ) {
      this.logger.debug(`Received message with term ${msg.term}, expected ${this.term}, and with view ${msg.view}, expected ${this.pbftState.view}.`);
      this.logger.debug(`Message is ${JSON.stringify(msg)}`);
      return false;
    }

    if ( (msg.conMsgType != ConsensusMessageType.PrePrepare) && !this.pbftState.candidateEBlock) {
      this.logger.debug(`Receieved ${JSON.stringify(msg)}, but have no candidate EB!`);
      return false;
    }
    return true;
  }

  @bind
  isValidEBlock(eBlockHash: string): boolean {
    if (eBlockHash != this.pbftState.candidateEBlock.hash) {
      this.logger.debug(`Mismatching hash- receieved ${eBlockHash}, expected ${this.pbftState.candidateEBlock.hash}`); // TODO maybe warning? Depends on when can happen
      return false;
    }
    // to avoid boilerplate- assuming that eblock content matches hash
    return true;
  }

  isRepresentativeEBlock(eBlock: EncryptedBlock): boolean {
    // dummy implementation, should verify EB contains at least one of node's etxs
    // if () {
    //   this.logger.warn(`Received invalid pre-prepare message from ${msg.sender}, EB didn't contain any of my etxs!}`);
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

  @bind
  countValidVotes(voteArr: boolean[]): number {
    let count = 0;
    for (let i = 0; i < voteArr.length; i++) {
      if (voteArr[i]) {
        if (this.utils.isCommitteeMember(this.cmap, i + 1)) {
          count += 1;
        }
        else {
          this.logger.warn(`${i + 1} submitted a vote, but not on committee!`);
        }
      }
    }
    return count;
  }

  @bind
  isValidByzMajorityVote(voteArr: boolean[]): boolean {
    return Utils.isAByzMajOfB(this.countValidVotes(voteArr), this.utils.committeeSize);
  }

  @bind
  isValidConMsg(msg: Message, conMsgType: ConsensusMessageType): boolean {
    if (msg.conMsgType != conMsgType) {
      this.logger.debug(`Expected message of type ${conMsgType}, got message of type ${msg.conMsgType}`);
      return false;
    }
    const ebHash = (conMsgType == ConsensusMessageType.PrePrepare) ? msg.eBlock.hash : msg.eBlockHash;
    if (this.pbftState.candidateEBlock && !this.isValidEBlock(ebHash)) {
      this.logger.debug(`Invalid Eblock (${ebHash}), msg=${JSON.stringify(msg)}`);
      return false;
    }
    // this.logger.debug(`VALID Eblock`);
    return true;
  }

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
    }
  }

  @bind
  handlePrePrepareMessage(msg: Message): void {
    if (!this.isInSyncMessage(msg)) {
      this.pbftState.outOfSyncMessages.push(msg);
      return;
    }
    if (!msg.sender == this.cmap[this.pbftState.view]) {
      this.logger.warn(`Received pre-prepare message from ${msg.sender}, expected from ${this.cmap[this.pbftState.view]}`);
      return;
    }
    if (!this.isRepresentativeEBlock(msg.eBlock)) {
      return;
    }
    this.logger.debug(`Received pre-prepare message for block (${msg.eBlock.term},${msg.eBlock.hash}) from ${msg.sender}`);
    this.pbftState.candidateEBlock = msg.eBlock;

    const prepareMsg: Message = { sender: this.nodeNumber, type: "ConsensusMessage", conMsgType: ConsensusMessageType.Prepare, term: this.term, view: this.pbftState.view, eBlockHash: msg.eBlock.hash };

    this.handlePrepareMessage(prepareMsg);

    if (!this.utils.isLeader(this.cmap, this.nodeNumber)) { // shortcut, committee members that receive pre-prepare should generate the corresponding prepare msg from the leader
    // and save bandwidth (the leader doesn't need to send another prepare message after the preprepare)
      const leaderPrepareMsg: Message = { sender: msg.sender, type: "ConsensusMessage", conMsgType: ConsensusMessageType.Prepare, term: this.term, view: this.pbftState.view, eBlockHash: msg.eBlock.hash };
      this.updateEvidence(leaderPrepareMsg);
      this.broadcastCommittee(prepareMsg);
    }


    return;

  }

  @bind
  handlePrepareMessage(msg: Message): void {
    // TODO what about the case where we receive 2f+1 prepare messages before preprepare? A: can ask for the prepare message
    // TODO is there a case where we don't have our own prepare message?
    this.recheckConMessages([ConsensusMessageType.PrePrepare, ConsensusMessageType.Prepare]); // check if maybe out of sync messages synced meanwhile
    if (!this.isInSyncMessage(msg)) { // TODO move to consensus handler
      this.pbftState.outOfSyncMessages.push(msg);
      return;
    }
    if (!this.isValidConMsg(msg, ConsensusMessageType.Prepare)) {
      return;
    }


    this.updateEvidence(msg);

    this.logger.debug(`Received ${this.countValidVotes(this.pbftState.blockProof.prepares)} votes out of ${this.pbftState.blockProof.prepares.length}, is ${this.pbftState.blockProof.prepares}`);
    // TODO move this to block proof
    if (this.isValidByzMajorityVote(this.pbftState.blockProof.prepares) && this.pbftState.candidateEBlock) {
      this.enterPrepared();

    }



  }


  @bind
  recheckConMessages(cmTypeArray: ConsensusMessageType[]): void {
    // this.logger.debug(`checking oos messages`);
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
       this.logger.debug(`Validated out of sync message ${JSON.stringify(msg)}`);
       this.updateEvidence(msg);
     }

  }

  @bind
  enterPrepared(): void {
    this.logger.log(`Entering Prepared stage.`);
    this.pbftState.prepared = true;
    const commitMsg: Message = { sender: this.nodeNumber, type: "ConsensusMessage", conMsgType: ConsensusMessageType.Commit, view: this.pbftState.view, term: this.term, eBlockHash: this.pbftState.candidateEBlock.hash };
    this.broadcastCommittee(commitMsg);
    this.handleCommitMessage(commitMsg);

  }

  @bind
  handleCommitMessage(msg: Message): void {
    this.recheckConMessages([ConsensusMessageType.PrePrepare, ConsensusMessageType.Prepare, ConsensusMessageType.Commit]); // check if maybe out of sync messages synced meanwhile
    if (!this.isInSyncMessage(msg)) { // TODO move to consensus handler
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

  @bind
  enterCommit(): void {
    this.logger.log(`Entering commit stage`);
    this.pbftState.committedLocal = true;
    this.pbftState.blockProof.committed = true;
    this.propagateBP(this.pbftState.blockProof, this.pbftState.candidateEBlock);
  }

  @bind
  propagateBP(BP: BlockProof, EB: EncryptedBlock): void {
    const committedMsg: Message = {sender: this.nodeNumber, type: "ConsensusMessage", conMsgType: ConsensusMessageType.Committed, blockProof: BP, eBlock: EB };
    this.netInterface.broadcast(committedMsg); // TODO replace with fast propagation protocol
    this.handleCommittedMessage(committedMsg);
  }

  @bind
  isValidCommittedMessage(msg: Message): boolean {
    if (!(msg.eBlock.term == this.term)) {
      // TODO handle node out of sync
      if (msg.eBlock.term > this.term) this.logger.warn(`Out of sync, at term ${this.term}, received committed block at term ${msg.eBlock.term}`);
      return false;
    }
    if (!(this.utils.areCmapsEqual(msg.eBlock.cmap, this.cmap))) {
      this.logger.warn(`Cmap mismatch, got ${msg.eBlock.cmap}, expected ${this.cmap}`);
      return false;
    }
    if (!this.utils.isCommitteeMember(this.cmap, msg.eBlock.creator)) {
      this.logger.warn(`Block creator ${msg.eBlock.creator} not in committee!`);
      return false;
    }
    if (!(this.isValidByzMajorityVote(msg.blockProof.prepares))) {
      this.logger.warn(`Missing prepare messages!`);
      return false;
    }
    if (!(this.isValidByzMajorityVote(msg.blockProof.commits))) {
      this.logger.warn(`Missing commit messages!`);
      return false;
    }
    if (!msg.blockProof.committed) {
      this.logger.warn(`Block not committed!`);
      return false;
    }
    return true;
  }

  @bind
  handleCommittedMessage(msg: Message): void {
    if (!this.isValidCommittedMessage(msg)) {
      return;
    }
    this.netInterface.broadcast(msg); // TODO replace with fast propagation protocol
    this.decryptor.enterDecryptStage(msg.eBlock);
    // TODO need to collect k shares, will be added later

  }

  @bind
  createBlock(eBlock: EncryptedBlock, dBlock: DecryptedBlock, blockProof: BlockProof): Block {
    const block: Block = { term: eBlock.term, encryptedBlock: eBlock, decryptedBlock: dBlock, blockProof: blockProof };

    return block;
  }

  @bind
  handleBlockDecrypted(dBlock: DecryptedBlock, eBlock: EncryptedBlock): void {
    this.logger.log(`Block ${eBlock.term} decrypted, entering new term.`);
    this.blockchain.addBlock(this.createBlock(eBlock, dBlock, this.pbftState.blockProof));
    this.enterNewTerm(dBlock);
  }




}
