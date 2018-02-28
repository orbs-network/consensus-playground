import * as _ from "lodash";
import { Message, Cmap, Utils, Block, EncryptedBlock, DecryptedBlock, BlockProof, ConsensusMessageType, Proposal, BlockShare } from "./common";
import { Blockchain } from "./Blockchain";
import { Mempool } from "./Mempool";
import { Timer } from "./Timer";
import { Decryptor } from "./Decryptor";
import { ConsensusEngine } from "./ConsensusEngine";
import { NetworkInterface } from "./NetworkInterface";
import { MempoolHandler } from "./MempoolHandler";
import { BlockchainHandler } from "./BlockchainHandler";
import { ConsensusHandler } from "./ConsensusHandler";
import { CryptoHandler } from "./CryptoHandler";
import { Syncer } from "./Syncer";

import BaseNode from "../../simulation/BaseNode";
import BaseScenario from "../../simulation/BaseScenario";
import { OrbsScenario } from "../../scenarios/oa-pbft/OrbsScenario";
import BaseEvent from "../../simulation/BaseEvent";
import MessageEvent from "../../simulation/events/MessageEvent";
import TimeoutEvent from "../../simulation/events/TimeoutEvent";
import NodeStartEvent from "../../simulation/events/NodeStartEvent";
import bind from "bind-decorator";


interface Map<T> {
    [K: number]: T;
}

export default class TestNode extends BaseNode {
  protected cmap: Cmap;
  protected term: number;
  protected view: number;
  protected mempool: Mempool;
  protected blockchain: Blockchain;
  protected decryptor: Decryptor;
  protected consensusEngine: ConsensusEngine;
  protected mempoolHandler: MempoolHandler;
  protected blockchainHandler: BlockchainHandler;
  protected consensusHandler: ConsensusHandler;
  protected cryptoHandler: CryptoHandler;
  protected timer: Timer;
  protected syncer: Syncer;
  public netInterface: NetworkInterface;
  protected committedEBtoDecrypt: Map<EncryptedBlock>;
  protected utils: Utils;

  constructor(scenario: BaseScenario) {
    super(scenario);
    this.term = 0;
    this.view = 0;
    this.utils = new Utils(this.scenario, this.nodeNumber, this.logger);
    this.mempool = new Mempool(this.scenario.randomizer);
    this.blockchain = new Blockchain();
    this.timer = new Timer();

    this.decryptor = new Decryptor();
    this.netInterface = new NetworkInterface(this.nodeNumber, this.outgoingConnections, this.mempoolHandler, this.blockchainHandler, this.cryptoHandler, this.consensusHandler, this.utils);
    this.consensusEngine = new ConsensusEngine(this.nodeNumber, this.decryptor, this.blockchain, this.mempool, this.netInterface, this.utils, this.timer);
    this.consensusHandler = new ConsensusHandler(this.consensusEngine, this.netInterface);
    this.mempoolHandler = new MempoolHandler();
    this.blockchainHandler = new BlockchainHandler(this.blockchain);
    this.cryptoHandler = new CryptoHandler(this.decryptor, this.netInterface);
    this.committedEBtoDecrypt = {};
    this.syncer = new Syncer(this.mempoolHandler, this.blockchainHandler, this.consensusHandler, this.cryptoHandler, this.netInterface, this.utils);



  }




  @bind
  onStart(event: NodeStartEvent): void {
    this.logger.debug(`Starting...`);
    if (this.scenario instanceof OrbsScenario) {
      this.utils.numNodes = this.scenario.numNodes; // after nodes created, so this is the correct value
      this.utils.committeeSize = this.scenario.committeeSize;
      this.utils.numByz = this.scenario.numByz;
      this.utils.sharingThreshold = this.scenario.sharingThreshold;
    }
    else { // maintain backwards compatibility for using base scenario (benchmark code for example)
      this.utils.numNodes = this.scenario.numNodes; // after nodes created, so this is the correct value
      this.utils.committeeSize = this.scenario.numNodes; // TODO this should be fraction of total number of nodes, just for benchmark purposes
      // default values
      this.utils.numByz = Math.floor(this.scenario.numNodes / 3);
      this.utils.sharingThreshold = this.utils.numByz + 1;
    }

    this.blockchain.init(this.utils.numNodes);
    this.decryptor.init(this.consensusEngine, this.netInterface, this.blockchain, this.utils);
    this.timer.init(this.consensusEngine, this.nodeNumber, this.scenario, this.utils, this.syncer);
    // this.committedEBtoDecrypt = {};
    // this.committedEBtoDecrypt[0] = this.blockchain.getLastBlock().encryptedBlock;
    // console.log(this.committedEBtoDecrypt);
    this.testFastCast();
  }


  @bind
  testFastCast(): void {
    // console.log(this.committedEBtoDecrypt);
    const lastDBlock = this.blockchain.getLastBlock().decryptedBlock;
    this.enterNewTerm(lastDBlock);

  }


  @bind
  enterNewTerm(lastDBlock: DecryptedBlock): void {
    this.cmap = this.consensusEngine.sortition(lastDBlock);
    this.term += 1;
    this.view += 1;
    this.utils.logger.log(`Entering term ${this.term}, committee is ${this.utils.getCommittee(this.cmap)}`);
    if (this.utils.isLeader(this.cmap, this.nodeNumber, this.view)) {
      this.utils.logger.log(`Chosen as leader`);
      // this.timer.setProposalTimer(PROPOSAL_TIMER_MS);
      // this.phase = Phase.Agreeing; // TODO fix phases
      const eBlock: EncryptedBlock = this.createNewEBlock();
      // console.log(this.committedEBtoDecrypt);
      // this.committedEBtoDecrypt[eBlock.term] = eBlock;
      // this.committedEBtoDecrypt[eBlock.term] = eBlock;
      const msg: Message = { sender: this.nodeNumber, type: "FastcastMessage", term: this.term, view: this.view, eBlock: eBlock, eBlockHash: eBlock.hash };
      this.handleFastcastMessage(msg);
      // this.decryptor.enterDecryptStage(msg.eBlock);
      // this.netInterface.broadcast(msg);
    }
  }


  @bind
  createNewEBlock(): EncryptedBlock {
    const randomContent = this.mempool.generateContent();
    const contentHash: string = Utils.hashContent(randomContent);
    const eBlock: EncryptedBlock = { term: this.term, view: this.view, content: randomContent, hash: contentHash, lastEBlockHash: this.blockchain.getLastBlock().encryptedBlock.hash, lastDBlockHash: this.blockchain.getLastBlock().decryptedBlock.hash, creator: this.nodeNumber, cmap: this.cmap };
    return eBlock;
  }


  @bind
  getMessageTopType(str: string): string {
    const i = str.indexOf("/");
    if (i > -1) return str.slice(0, i);
    else return str;
  }

  @bind
  onMessage(event: MessageEvent): void {
    const msg = <Message>event.message;
    // this.utils.logger.log("Message is: " + msg.type + msg.sender + event.target.nodeNumber);
    switch (this.getMessageTopType(msg.type)) {
      case "ConsensusMessage": {
        this.consensusHandler.handleMessage(msg);
      }
      case "MempoolMessage": {
        break;
      }
      case "BlockchainMessage": {
        break;
      }
      case "CryptoMessage": {
        this.cryptoHandler.handleMessage(msg);
        break;
      }
      case "FastcastMessage": {
        this.handleFastcastMessage(msg);
        break;
      }

    }
  }

  @bind
  handleFastcastMessage(msg: Message): void {
    console.log("BEFORE" + this.nodeNumber + ":  " + JSON.stringify(this.committedEBtoDecrypt));
    if (!this.committedEBtoDecrypt[msg.eBlock.term]) {
      this.committedEBtoDecrypt[msg.eBlock.term] = msg.eBlock;
      console.log("AFTER" + this.nodeNumber + ":  " + JSON.stringify(this.committedEBtoDecrypt));
      this.netInterface.fastcast(msg);
      this.handleBlockDecrypted(this.decryptor.decrypt(msg.eBlock), msg.eBlock, []);
    }
  }

  @bind
  handleBlockDecrypted(dBlock: DecryptedBlock, eBlock: EncryptedBlock, blockShares: BlockShare[]): void {
    this.utils.logger.log(`Block ${eBlock.term} decrypted, entering new term.`);
    const block: Block = { term: eBlock.term, encryptedBlock: eBlock, decryptedBlock: dBlock, blockProof: undefined, blockShares: blockShares };
    this.blockchain.addBlock(block);
    this.utils.logger.debug(`Added block ${JSON.stringify(block)} to blockchain...`);
    this.enterNewTerm(dBlock);
  }


  @bind
  onTimeout(event: TimeoutEvent): void {
    // this.time

  }

  @bind
  setTimeout(timeoutMs: number, message: any): void {
    this.timer.setTimeout(timeoutMs, message);
  }

  @bind
  broadcast(message: any): void {
    this.netInterface.broadcast(message);
  }

  @bind
  unicast(toNodeNumber: number, message: any): void {
    this.netInterface.unicast(toNodeNumber, message);
  }

  @bind
  benchmarkGetClosedBlocks(): Block[] {
    return this.blockchain.getClosedBlocks();
  }

  @bind
  benchmarkAreClosedBlocksIdentical(block1: Block, block2: Block): boolean {
    return block1.decryptedBlock.content == block2.decryptedBlock.content;
  }

}
