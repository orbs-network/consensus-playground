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


import OrbsBaseNode from "./OrbsBaseNode";
// import BaseScenario from "../../simulation/BaseScenario";
import OrbsScenario from "../../scenarios/oa-pbft/OrbsScenario";
import BaseEvent from "../../simulation/BaseEvent";
import MessageEvent from "../../simulation/events/MessageEvent";
import TimeoutEvent from "../../simulation/events/TimeoutEvent";
import NodeStartEvent from "../../simulation/events/NodeStartEvent";
import bind from "bind-decorator";



export default class HonestNode extends OrbsBaseNode {

  constructor(scenario: OrbsScenario) {
    super(scenario);
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
    this.syncer.init();
    this.timer.init(this.consensusEngine, this.nodeNumber, this.scenario, this.utils, this.syncer);
    this.consensusEngine.initConsensus(this.utils.numNodes, this.utils.committeeSize, this.utils.numByz, this.syncer);

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
    // TODO should have some logic for recovering from crashes
    if ((msg.term > this.consensusEngine.getTerm() + 1) && !this.syncer.syncing) {
      this.utils.logger.log(`Received message from term ${msg.term}, at term ${this.consensusEngine.getTerm()}. Entering syncing mode`);
      this.syncer.requestSync();
    }
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
      case "SyncMessage": {
        this.syncer.handleMessage(msg);
        break;
      }

    }
  }



}
