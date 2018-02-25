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
import BaseScenario from "../../simulation/BaseScenario";
import { OrbsScenario } from "../../scenarios/oa-pbft/OrbsScenario";
import BaseEvent from "../../simulation/BaseEvent";
import MessageEvent from "../../simulation/events/MessageEvent";
import TimeoutEvent from "../../simulation/events/TimeoutEvent";
import NodeStartEvent from "../../simulation/events/NodeStartEvent";
import bind from "bind-decorator";

const MAX_CRASH_MS = 5000;
const MAX_CRASH_DUR_MS = 3000;

export default class FaultyForFewTermsNode extends HonestNode {
  protected sleeping = false;
  protected crashed = false;
  protected sleepTimestamp = this.scenario.randomizer.nextIntegerInRange(1, MAX_CRASH_MS);
  protected wakeTimestamp = this.sleepTimestamp + this.scenario.randomizer.nextIntegerInRange(1, MAX_CRASH_DUR_MS);
  //
  @bind
  onMessage(event: MessageEvent): void {
    const msg = <Message>event.message;
    if (event.timestamp >= this.sleepTimestamp && !this.sleeping && !this.crashed) {
      this.sleeping = true;
      this.crashed = true;
      this.utils.logger.debug(`Oh no, crashing!`);
    }
    if (event.timestamp >= this.wakeTimestamp && this.sleeping && this.crashed) {
      this.sleeping = false;
      this.utils.logger.debug(`Waking up!`);
      // this.syncer.requestSync();
    }
    if (this.sleeping) {
      return;
    }
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
