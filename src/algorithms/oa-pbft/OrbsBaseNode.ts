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
import { Syncer } from "./Syncer";

import BaseNode from "../../simulation/BaseNode";
import BaseScenario from "../../simulation/BaseScenario";
import { OrbsScenario } from "../../scenarios/oa-pbft/OrbsScenario";
import BaseEvent from "../../simulation/BaseEvent";
import MessageEvent from "../../simulation/events/MessageEvent";
import TimeoutEvent from "../../simulation/events/TimeoutEvent";
import NodeStartEvent from "../../simulation/events/NodeStartEvent";
import bind from "bind-decorator";



export default abstract class OrbsBaseNode extends BaseNode {
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
    this.blockchainHandler = new BlockchainHandler(this.blockchain);
    this.cryptoHandler = new CryptoHandler(this.decryptor, this.netInterface);
    this.syncer = new Syncer(this.mempoolHandler, this.blockchainHandler, this.consensusHandler, this.cryptoHandler, this.netInterface, this.utils);
  }


}
