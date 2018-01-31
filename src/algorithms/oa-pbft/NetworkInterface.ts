import * as _ from "lodash";
import { MempoolHandler } from "./MempoolHandler";
import { BlockchainHandler } from "./BlockchainHandler";
import { ConsensusHandler } from "./ConsensusHandler";
import { CryptoHandler } from "./CryptoHandler";

import { Utils, Message } from "./common";
import Logger from "../../simulation/Logger";
import BaseEvent from "../../simulation/BaseEvent";
import BaseConnection from "../../simulation/BaseConnection";
import BaseScenario from "../../simulation/BaseScenario";
import MessageEvent from "../../simulation/events/MessageEvent";
import Endpoint from "../../simulation/Endpoint";

import bind from "bind-decorator";


export class NetworkInterface implements Endpoint {

  protected mempoolHandler: MempoolHandler;
  protected blockchainHandler: BlockchainHandler;
  protected cryptoHandler: CryptoHandler;
  protected consensusHandler: ConsensusHandler;
  public nodeNumber: number;
  protected scenario: BaseScenario;
  public outgoingConnections: BaseConnection[] = [];

  protected logger: Logger;

  constructor(outgoingConnections: BaseConnection[], mempoolHandler: MempoolHandler, blockchainHandler: BlockchainHandler, cryptoHandler: CryptoHandler, consensusHandler: ConsensusHandler, nodeNumber: number, scenario: BaseScenario, logger: Logger) {
    this.outgoingConnections = outgoingConnections;
    this.mempoolHandler = mempoolHandler;
    this.blockchainHandler = blockchainHandler;
    this.cryptoHandler = cryptoHandler;
    this.consensusHandler = consensusHandler;
    this.scenario = scenario;
    this.nodeNumber = nodeNumber;
    this.logger = logger;
  }

  @bind
  handleEvent(event: BaseEvent): void {
    if (event instanceof MessageEvent) {
      this.onMessage(event);
    }
  }

  @bind
  onMessage(event: MessageEvent): void {
    const msg = <Message>event.message;
    switch (msg.type) {
      case "ConsensusMessage": {
        break;
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
  broadcast(message: any): void {
    for (const connection of this.outgoingConnections) {
      connection.send(message);
      this.scenario.statistics.totalSentMessages++;
      this.scenario.statistics.totalSentBytes += JSON.stringify(message).length;
      if (!this.scenario.statistics.totalReceivedMessagesPerNode[connection.to.nodeNumber]) this.scenario.statistics.totalReceivedMessagesPerNode[connection.to.nodeNumber] = 0;
      this.scenario.statistics.totalReceivedMessagesPerNode[connection.to.nodeNumber]++;
    }
    this.scenario.statistics.totalBroadcasts++;
  }

  @bind
  unicast(toNodeNumber: number, message: any): void {
    for (const connection of this.outgoingConnections) {
      if (connection.to.nodeNumber === toNodeNumber) {
        connection.send(message);
        this.scenario.statistics.totalSentMessages++;
        this.scenario.statistics.totalSentBytes += JSON.stringify(message).length;
        if (!this.scenario.statistics.totalReceivedMessagesPerNode[connection.to.nodeNumber]) this.scenario.statistics.totalReceivedMessagesPerNode[connection.to.nodeNumber] = 0;
        this.scenario.statistics.totalReceivedMessagesPerNode[connection.to.nodeNumber]++;
      }
    }
    this.scenario.statistics.totalUnicasts++;
  }

}
