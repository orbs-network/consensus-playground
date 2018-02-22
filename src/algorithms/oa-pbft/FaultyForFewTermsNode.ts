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

const SLEEP_TERM = 2;
const AWAKE_TERM = 6;

export default class FaultyForFewTermsNode extends HonestNode {
  protected sleeping = false;
  //
  @bind
  onMessage(event: MessageEvent): void {
    const msg = <Message>event.message;
    if (msg.term == SLEEP_TERM && !this.sleeping) {
      this.sleeping = true;
      this.utils.logger.debug(`Oh no, crashing!`);
    }
    if (msg.term >= AWAKE_TERM && this.sleeping) {
      this.sleeping = false;
      this.utils.logger.debug(`Waking up!`);
      this.syncer.requestSync();
    }
    if (this.sleeping) {
      return;
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
