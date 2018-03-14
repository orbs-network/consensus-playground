import * as _ from "lodash";
import { MempoolHandler } from "./MempoolHandler";
import { BlockchainHandler } from "./BlockchainHandler";
import { ConsensusHandler } from "./ConsensusHandler";
import { CryptoHandler } from "./CryptoHandler";
import { NetworkInterface, NetworkPropagationMode } from "./NetworkInterface";

import { Utils, Message, Map } from "./common";
import BaseEvent from "../../simulation/BaseEvent";
import BaseConnection from "../../simulation/BaseConnection";
import BaseScenario from "../../simulation/BaseScenario";
import MessageEvent from "../../simulation/events/MessageEvent";
import BandwidthEndpoint from "../../simulation/BandwidthEndpoint";

import bind from "bind-decorator";

const DEFAULT_BANDWIDTH_BITS_SEC = 1000000000;
const BITS_TO_BYTES = 8;
const MS_TO_SEC = 1000;
// const fillRangeModulo = (start, end, cap) => {
//   return Array(end - start + 1).fill(0).map((item, index) => (start + index) % cap);
// };

export class BandwidthNetworkInterface extends NetworkInterface implements BandwidthEndpoint {

  protected txBand: Map<number>;
  protected rxBand: Map<number>;
  protected bandwidth: number;

  constructor(nodeNumber: number, outgoingConnections: BaseConnection[], mempoolHandler: MempoolHandler, blockchainHandler: BlockchainHandler,
    cryptoHandler: CryptoHandler, consensusHandler: ConsensusHandler, utils: Utils, networkMode: NetworkPropagationMode, bandwidth: number = DEFAULT_BANDWIDTH_BITS_SEC ) {
    super(nodeNumber, outgoingConnections, mempoolHandler, blockchainHandler, cryptoHandler, consensusHandler, utils, networkMode);
    this.txBand = {};
    this.rxBand = {};
    this.bandwidth = this.bwPerSecToBwPerTs(bandwidth);
  }

  @bind
  bwPerSecToBwPerTs(bwBitsSec: number): number {
    const bandwidthBytesTs = (bwBitsSec / BITS_TO_BYTES) / this.utils.scenario.msToTs(MS_TO_SEC);
    return bandwidthBytesTs;
  }

  @bind
  handleEvent(event: BaseEvent): void {
    if (event instanceof MessageEvent) {
      this.onMessage(event);
    }
  }

  @bind
  setBandwidth(bandwidth: number): void {
    this.utils.logger.debug(`Setting bandwidth to be ${this.bwPerSecToBwPerTs(bandwidth)}`);
    this.bandwidth = this.bwPerSecToBwPerTs(bandwidth);
  }

  @bind
  fillBandwidth(msgSize: number, baseArriveTime: number, bwMap: Map<number>): number {
    let leftToTransmit = msgSize;
    let atTimestamp = baseArriveTime;
    let usedBandwidthAtTimestamp = 0;
    while (leftToTransmit > 0 && (atTimestamp <= this.utils.scenario.maxSimulationTimestampMs())) {
      bwMap[atTimestamp] = bwMap[atTimestamp] ? bwMap[atTimestamp] : 0;
      usedBandwidthAtTimestamp = Math.min(this.bandwidth - bwMap[atTimestamp], leftToTransmit);
      leftToTransmit = Math.max(leftToTransmit - usedBandwidthAtTimestamp, 0);
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



}
