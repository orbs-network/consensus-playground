import * as _ from "lodash";
import { MempoolHandler } from "./MempoolHandler";
import { BlockchainHandler } from "./BlockchainHandler";
import { ConsensusHandler } from "./ConsensusHandler";
import { CryptoHandler } from "./CryptoHandler";

import { Utils, Message } from "./common";
import BaseEvent from "../../simulation/BaseEvent";
import BaseConnection from "../../simulation/BaseConnection";
import BaseScenario from "../../simulation/BaseScenario";
import MessageEvent from "../../simulation/events/MessageEvent";
import Endpoint from "../../simulation/Endpoint";

import bind from "bind-decorator";



const fillRangeModulo = (start, end, cap) => {
  return Array(end - start + 1).fill(0).map((item, index) => (start + index) % cap + 1); // second +1 -> return to nodes' ids
};
export class NetworkInterface implements Endpoint {

  protected mempoolHandler: MempoolHandler;
  protected blockchainHandler: BlockchainHandler;
  protected cryptoHandler: CryptoHandler;
  protected consensusHandler: ConsensusHandler;
  public nodeNumber: number;
  protected scenario: BaseScenario;
  public outgoingConnections: BaseConnection[] = [];
  protected utils: Utils;

  constructor(nodeNumber: number, outgoingConnections: BaseConnection[], mempoolHandler: MempoolHandler, blockchainHandler: BlockchainHandler, cryptoHandler: CryptoHandler, consensusHandler: ConsensusHandler, utils: Utils) {
    this.nodeNumber = nodeNumber;
    this.outgoingConnections = outgoingConnections;
    this.mempoolHandler = mempoolHandler;
    this.blockchainHandler = blockchainHandler;
    this.cryptoHandler = cryptoHandler;
    this.consensusHandler = consensusHandler;
    this.utils = utils;

  }

  @bind
  handleEvent(event: BaseEvent): void {
    if (event instanceof MessageEvent) {
      this.onMessage(event);
    }
  }


/**
 *
 *
 * @param {MessageEvent} event
 */
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



/**
 * send message to multiple recipients
 * avoids duplicates
 * @param {number[]} toNodeNumber
 * @param {*} message
 */
@bind
  multicast(toNodeNumber: number[], message: any): void {
    const allNodesTo: number[] = new Array(this.utils.numNodes).fill(0);
    for (const to of toNodeNumber) {
      allNodesTo[to - 1] = 1; // nodes ids run from 1..
    }
    for (const connection of this.outgoingConnections) {
      if (allNodesTo[connection.to.nodeNumber - 1]) {
        connection.send(message);
        this.utils.scenario.statistics.totalSentMessages++;
        this.utils.scenario.statistics.totalSentBytes += JSON.stringify(message).length;
        if (!this.utils.scenario.statistics.totalReceivedMessagesPerNode[connection.to.nodeNumber]) this.utils.scenario.statistics.totalReceivedMessagesPerNode[connection.to.nodeNumber] = 0;
        this.utils.scenario.statistics.totalReceivedMessagesPerNode[connection.to.nodeNumber]++;
      }
      this.utils.scenario.statistics.totalMulticasts++;
      }
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

  @bind
  fastcast(message: any, mapping?: number[]): void {
    if (!mapping) {
      const mapping: number[] = Array.from(new Array(this.utils.numNodes), (val, index) => index + 1);
    }
    const vertex =  Math.floor(mapping.indexOf(this.nodeNumber) / (this.utils.numByz + 1)); // current node index according to mapping
    const numGroups = Math.ceil(mapping.length / (this.utils.numByz + 1));   // number of f+1 groups
    const leftStart = ((vertex << 1) + 1) % numGroups;  // send to groups with indices leftStart and rightStart
    const rightStart = (leftStart + 1) % numGroups;
    let toNodeNumber = fillRangeModulo(leftStart * (this.utils.numByz + 1), (leftStart + 1) * (this.utils.numByz + 1) , mapping.length);  // generate array of nodes ids accordingly
    toNodeNumber = toNodeNumber.concat(fillRangeModulo(rightStart * (this.utils.numByz + 1), (rightStart + 1) * (this.utils.numByz + 1) , mapping.length));
    // do not send to 'this' node
    const index = toNodeNumber.indexOf(this.nodeNumber, 0);
    if (index > -1) {
       toNodeNumber.splice(index, 1);
    }
    this.multicast(toNodeNumber, message);
  }

}






