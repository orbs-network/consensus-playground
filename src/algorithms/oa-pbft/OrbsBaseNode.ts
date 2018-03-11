import * as _ from "lodash";
import { Map, Utils, Block, Message, F } from "./common";
import { Blockchain } from "./Blockchain";
import { Mempool } from "./Mempool";
import { Timer } from "./Timer";
import { Decryptor } from "./Decryptor";
import { ConsensusEngine } from "./ConsensusEngine";
import { NetworkInterface } from "./NetworkInterface";
import { BandwidthNetworkInterface } from "./BandwidthNetworkInterface";
import { MempoolHandler } from "./MempoolHandler";
import { BlockchainHandler } from "./BlockchainHandler";
import { ConsensusHandler } from "./ConsensusHandler";
import { CryptoHandler } from "./CryptoHandler";
import { Syncer } from "./Syncer";
import BandwidthEndpoint from "../../simulation/BandwidthEndpoint";
import BaseNode from "../../simulation/BaseNode";
// import BaseScenario from "../../simulation/BaseScenario";
import OrbsScenario from "../../scenarios/oa-pbft/OrbsScenario";
// import BaseOrbsScenarioWithNode from "../../oa-benchmark/BaseOrbsScenarioWithNode";
import BaseEvent from "../../simulation/BaseEvent";
import MessageEvent from "../../simulation/events/MessageEvent";
import TimeoutEvent from "../../simulation/events/TimeoutEvent";
import NodeStartEvent from "../../simulation/events/NodeStartEvent";
import bind from "bind-decorator";



export default abstract class OrbsBaseNode extends BaseNode implements BandwidthEndpoint {
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
  public netInterface: BandwidthNetworkInterface;
  protected utils: Utils;

  constructor(scenario: OrbsScenario) {
    super(scenario);
    this.utils = new Utils(this.scenario, this.nodeNumber, this.logger);
    this.mempool = new Mempool(this.scenario.randomizer);
    this.blockchain = new Blockchain();
    this.timer = new Timer();

    this.decryptor = new Decryptor();
    // this.netInterface = new NetworkInterface(this.nodeNumber, this.outgoingConnections, this.mempoolHandler,
    //   this.blockchainHandler, this.cryptoHandler, this.consensusHandler, this.utils, scenario.getNetworkMode());
    this.netInterface = new BandwidthNetworkInterface(this.nodeNumber, this.outgoingConnections, this.mempoolHandler,
      this.blockchainHandler, this.cryptoHandler, this.consensusHandler, this.utils, scenario.getNetworkMode());
    this.consensusEngine = new ConsensusEngine(this.nodeNumber, this.decryptor, this.blockchain, this.mempool, this.netInterface, this.utils, this.timer);
    this.consensusHandler = new ConsensusHandler(this.consensusEngine, this.netInterface);
    this.mempoolHandler = new MempoolHandler();
    this.blockchainHandler = new BlockchainHandler(this.blockchain);
    this.cryptoHandler = new CryptoHandler(this.decryptor, this.netInterface);
    this.syncer = new Syncer(this.mempoolHandler, this.blockchainHandler, this.consensusHandler, this.cryptoHandler, this.netInterface, this.utils);
  }

  @bind
  addTxEvent(msgSize: number): number {
    return this.netInterface.addTxEvent(msgSize);
  }

  @bind
  addRxEvent(msgSize: number, baseArriveTime: number): number {
    return this.netInterface.addRxEvent(msgSize, baseArriveTime);
  }

  @bind
  setBandwidth(bandwidth: number): void {
    this.netInterface.setBandwidth(bandwidth);
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
  benchmarkGetClosedBlocksMap(): Map<Block> {
    return this.blockchain.getClosedBlocksMap();
  }

  @bind
  benchmarkAreClosedBlocksIdentical(block1: Block, block2: Block): boolean {
    return block1.decryptedBlock.content == block2.decryptedBlock.content;
  }

}
