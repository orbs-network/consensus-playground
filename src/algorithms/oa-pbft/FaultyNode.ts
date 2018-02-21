import * as _ from "lodash";
import { Utils, Block, Message, F } from "./common";
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

import BaseNode from "../../simulation/BaseNode";
import BaseScenario from "../../simulation/BaseScenario";
import BaseEvent from "../../simulation/BaseEvent";
import MessageEvent from "../../simulation/events/MessageEvent";
import TimeoutEvent from "../../simulation/events/TimeoutEvent";
import NodeStartEvent from "../../simulation/events/NodeStartEvent";
import bind from "bind-decorator";


/**
 * This node simply doesn't process Consensus Messages so it won't take part in
 * the consensus process.
 */
export default class FaultyNode extends BaseNode {
  protected mempool: Mempool;
  protected blockchain: Blockchain;
  protected decryptor: Decryptor;
  protected consensusEngine: ConsensusEngine;
  protected mempoolHandler: MempoolHandler;
  protected blockchainHandler: BlockchainHandler;
  protected consensusHandler: ConsensusHandler;
  protected cryptoHandler: CryptoHandler;
  protected timer: Timer;
  public netInterface: NetworkInterface;

  protected utils: Utils;

  constructor(scenario: BaseScenario) {
    super(scenario);
    this.utils = new Utils(this.scenario, this.nodeNumber, this.logger);
    this.mempool = new Mempool(this.scenario.randomizer);
    this.blockchain = new Blockchain();
    this.timer = new Timer();

    this.decryptor = new Decryptor();
    this.netInterface = new NetworkInterface(this.nodeNumber, this.outgoingConnections, this.mempoolHandler, this.blockchainHandler, this.cryptoHandler, this.consensusHandler, this.utils);
    this.consensusEngine = new ConsensusEngine(this.nodeNumber, this.decryptor, this.blockchain, this.mempool, this.netInterface, this.utils, this.timer);

    this.consensusHandler = new ConsensusHandler(this.consensusEngine, this.netInterface);
    this.mempoolHandler = new MempoolHandler();
    this.blockchainHandler = new BlockchainHandler();
    this.cryptoHandler = new CryptoHandler(this.decryptor, this.netInterface);






  }

  @bind
  onStart(event: NodeStartEvent): void {
    this.logger.debug(`Faulty node "starting"...`);
    this.utils.numNodes = this.scenario.numNodes; // after nodes created, so this is the correct value
    this.utils.committeeSize = this.scenario.numNodes; // TODO this should be fraction of total number of nodes, just for benchmark purposes
    this.utils.numByz = F;
    this.blockchain.init(this.utils.numNodes);
    this.decryptor.init(this.consensusEngine, this.netInterface, this.blockchain, this.utils);
    this.timer.init(this.consensusEngine, this.nodeNumber, this.scenario, this.logger);
    this.utils.numNodes = this.utils.numNodes;
    this.utils.committeeSize = this.utils.committeeSize;
    this.utils.numByz = F;
  }

  @bind
  onMessage(event: MessageEvent): void {
    const msg = <Message>event.message;
    switch (msg.type) {
      case "ConsensusMessage": {
        // this.consensusHandler.handleMessage(msg);
      }
      case "MempoolMessage": {
        break;
      }
      case "BlockchainMessage": {
        break;
      }
      case "CryptoMessage": {
        break;
      }

    }
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
