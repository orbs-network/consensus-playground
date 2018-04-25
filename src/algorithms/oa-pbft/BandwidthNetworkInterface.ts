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

export class BandwidthNetworkInterface extends NetworkInterface implements BandwidthEndpoint {

  // bandwidths modelled by maps, where key is timestamp and value is occupoed bw in bytes
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

 /**
  * Given a message size in bytes, base message arrival timestamp and bandwidth map ,
  * return the timestamp at which the message transmission/reception was completed
  */
  @bind
  fillBandwidth(msgSizeBytes: number, baseArriveTime: number, bwMap: Map<number>): number {
    let leftToTransmit = msgSizeBytes;
    let atTimestamp = baseArriveTime;
    let usedBandwidthAtTimestamp = 0;
    while (leftToTransmit > 0 && (atTimestamp <= this.utils.scenario.maxSimulationTimestampMs())) {
      bwMap[atTimestamp] = bwMap[atTimestamp] ? bwMap[atTimestamp] : 0;
      usedBandwidthAtTimestamp = Math.min(this.bandwidth - bwMap[atTimestamp], leftToTransmit);
      leftToTransmit = Math.max(leftToTransmit - usedBandwidthAtTimestamp, 0);
      bwMap[atTimestamp] += usedBandwidthAtTimestamp;
      atTimestamp ++;
    }
    return (atTimestamp - 1); // when the final part of the message was sent/received
  }

  /**
   * Add a transmision event of a message of size msgSizeBytes,
   * return the timestamp at which the message transmission was completed
   */
  @bind
  addTxEvent(msgSizeBytes: number): number {
    const txTime = this.fillBandwidth(msgSizeBytes, this.utils.scenario.currentTimestamp, this.txBand);
    return txTime;
  }

  /**
   * Add a reception event of a message of size msgSizeBytes,
   * return the timestamp at which the message reception was completed
   */
  @bind
  addRxEvent(msgSizeBytes: number, baseArriveTime: number): number {
    const rxTime = this.fillBandwidth(msgSizeBytes, baseArriveTime, this.rxBand);
    return rxTime;
  }



}
