import * as _ from "lodash";
import { MempoolHandler } from "./MempoolHandler";
import { BlockchainHandler } from "./BlockchainHandler";
import { ConsensusHandler } from "./ConsensusHandler";
import { CryptoHandler } from "./CryptoHandler";
import { NetworkInterface } from "./NetworkInterface";

import { Utils, Message, Map } from "./common";
import BaseEvent from "../../simulation/BaseEvent";
import BaseConnection from "../../simulation/BaseConnection";
import BaseScenario from "../../simulation/BaseScenario";
import MessageEvent from "../../simulation/events/MessageEvent";
import BandwidthEndpoint from "../../simulation/BandwidthEndpoint";

import bind from "bind-decorator";

const DEFAULT_BANDWIDTH = 10000;

const fillRangeModulo = (start, end, cap) => {
  return Array(end - start + 1).fill(0).map((item, index) => (start + index) % cap);
};

export class BandwidthNetworkInterface extends NetworkInterface implements BandwidthEndpoint {

  protected txBand: Map<number>;
  protected rxBand: Map<number>;
  protected bandwidth: number;

  constructor(nodeNumber: number, outgoingConnections: BaseConnection[], mempoolHandler: MempoolHandler, blockchainHandler: BlockchainHandler, cryptoHandler: CryptoHandler, consensusHandler: ConsensusHandler, utils: Utils, bandwidth: number = DEFAULT_BANDWIDTH ) {
    super(nodeNumber, outgoingConnections, mempoolHandler, blockchainHandler, cryptoHandler, consensusHandler, utils);
    this.txBand = {};
    this.rxBand = {};
    this.bandwidth = bandwidth;

  }

  @bind
  handleEvent(event: BaseEvent): void {
    if (event instanceof MessageEvent) {
      this.onMessage(event);
    }
  }

  @bind
  fillBandwidth(msgSize: number, baseArriveTime: number, bwMap: Map<number>): number {
    let leftToTransmit = msgSize;
    let atTimestamp = baseArriveTime;
    let usedBandwidthAtTimestamp = 0;
    while (leftToTransmit > 0 || (this.utils.scenario.maxSimulationTimestampMs() <= atTimestamp )) {
      bwMap[atTimestamp] = bwMap[atTimestamp] ? bwMap[atTimestamp] : 0;
      usedBandwidthAtTimestamp = Math.min(this.bandwidth - bwMap[atTimestamp], leftToTransmit);
      leftToTransmit = Math.min(leftToTransmit - usedBandwidthAtTimestamp, 0);
      bwMap[atTimestamp] += usedBandwidthAtTimestamp;
      atTimestamp ++;
    }
    return (atTimestamp - 1); // when the final part of the message was sent
  }

  @bind
  addTxEvent(msgSize: number): number {
    const txTime = this.fillBandwidth(msgSize, this.utils.scenario.currentTimestamp, this.txBand);
    return txTime;
  }

  @bind
  addRxEvent(msgSize: number, baseArriveTime: number): number {
    const rxTime = this.fillBandwidth(msgSize, baseArriveTime, this.rxBand);
    return rxTime;
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
      this.utils.scenario.statistics.totalSentMessages++;
      this.utils.scenario.statistics.totalSentBytes += JSON.stringify(message).length;
      if (!this.utils.scenario.statistics.totalReceivedMessagesPerNode[connection.to.nodeNumber]) this.utils.scenario.statistics.totalReceivedMessagesPerNode[connection.to.nodeNumber] = 0;
      this.utils.scenario.statistics.totalReceivedMessagesPerNode[connection.to.nodeNumber]++;
      this.utils.scenario.statistics.totalBroadcasts++;
    }
  }



/**
 * send message to multiple recipients - does not send message to self + avoids duplicates
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
          this.utils.logger.log("ToNode " + connection.to.nodeNumber);
          connection.send(message);
          this.utils.scenario.statistics.totalSentMessages++;
          this.utils.scenario.statistics.totalSentBytes += JSON.stringify(message).length;
          if (!this.utils.scenario.statistics.totalReceivedMessagesPerNode[connection.to.nodeNumber]) this.utils.scenario.statistics.totalReceivedMessagesPerNode[connection.to.nodeNumber] = 0;
          this.utils.scenario.statistics.totalReceivedMessagesPerNode[connection.to.nodeNumber]++;
          this.utils.scenario.statistics.totalMulticasts++;
        }
      }
  }


  @bind
  unicast(toNodeNumber: number, message: any): void {
    for (const connection of this.outgoingConnections) {
      if (connection.to.nodeNumber === toNodeNumber) {
        connection.send(message);
        this.utils.scenario.statistics.totalSentMessages++;
        this.utils.scenario.statistics.totalSentBytes += JSON.stringify(message).length;
        if (!this.utils.scenario.statistics.totalReceivedMessagesPerNode[connection.to.nodeNumber]) this.utils.scenario.statistics.totalReceivedMessagesPerNode[connection.to.nodeNumber] = 0;
        this.utils.scenario.statistics.totalReceivedMessagesPerNode[connection.to.nodeNumber]++;
        this.utils.scenario.statistics.totalUnicasts++;
      }
    }
  }

  @bind
  fastcast(message: any, mapping?: number[]): void {
    this.broadcast(message);
    // if (!mapping) {
    //   mapping = Array.from(new Array(this.utils.numNodes), (val, index) => index + 1);
    // }
    // const vertex =  Math.floor(mapping.indexOf(this.nodeNumber) / (this.utils.numByz + 1)); // current node index according to mapping
    // const numGroups = Math.ceil(mapping.length / (this.utils.numByz + 1));   // number of f+1 groups
    // const leftStart = ((vertex << 1) + 1) % numGroups;  // send to groups with indices leftStart and rightStart
    // const rightStart = (leftStart + 1) % numGroups;
    // // const leftStart = (vertex << 1) % numGroups;  // send to groups with indices leftStart and rightStart
    // // const rightStart = (leftStart + 1) % numGroups;
    // let indices = fillRangeModulo(leftStart * (this.utils.numByz + 1), ((leftStart + 1) * (this.utils.numByz + 1) - 1) , mapping.length);  // generate array of nodes ids accordingly
    // indices = indices.concat(fillRangeModulo(rightStart * (this.utils.numByz + 1), ((rightStart + 1) * (this.utils.numByz + 1) - 1), mapping.length));
    // const sendTo = mapping.filter(nodeNumber => indices.indexOf(mapping.indexOf(nodeNumber)) > -1); // filter out nodes ids whose indices are not in indices
    // this.multicast(sendTo, message);
    // let str = "$$$$$$$ FastCast  $$$$$$$$$$$ msg:" + JSON.stringify(message) + " from-id: " + this.nodeNumber + ", vertex: " + vertex + " left: " + leftStart + " right: " + rightStart + " toIds: ";
    // for (const to of sendTo) {
    //   str += to + ",  ";
    // }
    // this.utils.logger.log(str.slice(0, str.length - 3));

  }

}
