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
import HonestNode from "./HonestNode";

import BaseNode from "../../simulation/BaseNode";
import OrbsBaseNode from "./OrbsBaseNode";
// import BaseScenario from "../../simulation/BaseScenario";
import OrbsScenario from "../../scenarios/oa-pbft/OrbsScenario";
import BaseEvent from "../../simulation/BaseEvent";
import MessageEvent from "../../simulation/events/MessageEvent";
import TimeoutEvent from "../../simulation/events/TimeoutEvent";
import NodeStartEvent from "../../simulation/events/NodeStartEvent";
import bind from "bind-decorator";

const MAX_CRASH_MS = 5000;
const MAX_CRASH_DUR_MS = 3000;

export default class FaultyForFewTermsNode extends HonestNode {
  protected sleepTimestamp = this.scenario.randomizer.nextIntegerInRange(1, MAX_CRASH_MS);
  protected wakeTimestamp = this.sleepTimestamp + this.scenario.randomizer.nextIntegerInRange(1, MAX_CRASH_DUR_MS);

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

    this.timer.setSleepTimer(this.sleepTimestamp);
    this.timer.setWakeupTimer(this.wakeTimestamp);
    this.utils.logger.debug(`Will be crashed between [${this.sleepTimestamp},${this.wakeTimestamp}]`);

  }

  @bind
  onMessage(event: MessageEvent): void {
    const msg = <Message>event.message;
    // if (event.timestamp >= this.sleepTimestamp && !this.utils.sleeping && !this.crashed) {
    //   this.utils.sleeping = true;
    //   this.crashed = true;
    //   this.utils.logger.log(`Oh no, crashing!`);
    //   this.utils.logger.debug(`Will wake up at ${this.wakeTimestamp}`);
    // }
    // if (event.timestamp >= this.wakeTimestamp && this.utils.sleeping && this.crashed) {
    //   this.utils.sleeping = false;
    //   this.utils.logger.log(`Waking up!`);
    //   // this.syncer.requestSync();
    // }
    if (this.utils.sleeping) {
      return;
    }
    if ((msg.term > this.consensusEngine.getTerm() + 1) && !this.syncer.syncing) {
      this.utils.logger.log(`Received message from term ${msg.term}, at term ${this.consensusEngine.getTerm()}. Entering syncing mode`);
      this.syncer.requestSync();
    }

    switch (Utils.getMessageTopType(msg.type)) {
      case "ConsensusMessage": {
        this.consensusHandler.handleMessage(msg);
        break;
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
