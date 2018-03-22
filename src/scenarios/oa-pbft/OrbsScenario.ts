import * as _ from "lodash";
import BaseNode from "../../simulation/BaseNode";
import BaseScenario from "../../simulation/BaseScenario";
import { NetworkPropagationMode } from "../../algorithms/oa-pbft/NetworkInterface";
import { Utils, Message, ConsensusMessageType, CryptoMessageType, SyncerMessageType } from "../../algorithms/oa-pbft/common";
import bind from "bind-decorator";
import Statistics from "../../simulation/Statistics";


const MAX_SIMULATION_TIMESTAMP_MS = 10000;
const NETWORK_MODE = NetworkPropagationMode.Fastcast;

const DEFAULT_BANDWIDTH_BITS_SEC = 1000000000;
const NETWORK_MIN_DELAY_MS = 10;
const NETWORK_MAX_DELAY_MS = 370;
const DEFAULT_MSG_SIZE_BYTES = 500;
const DEFAULT_ETX_SIZE_BYTES = 250;
const DEFAULT_SHARE_SIZE_BYTES = 60;
const DEFAULT_NUM_ETX_PER_BLOCK = 1000;



export interface OrbsExpConfig {
  name: string;
  nNodesToCreate: number;
  committeeSize: number;
  numByz: number;
  sharingThreshold: number;
  proposalTimeoutMs?: number;
  faultyNodeName: string;
  networkConfiguration: NetworkConfiguration;
}

export default abstract class OrbsScenario extends BaseScenario {
  public committeeSize: number;
  public numByz: number;
  public sharingThreshold: number;
  public maxSimulationTimestamp: number;
  protected seed: string;
  protected networkPropagationMode: NetworkPropagationMode;
  public oaConfig: OrbsExpConfig;


  constructor(seed: string, oaConfig: OrbsExpConfig = undefined) {
    super(seed);
    if (!oaConfig) console.log(`Undefined oa config`);
    this.oaConfig = oaConfig;
    this.seed = seed;
    this.committeeSize = this.numNodes;
    this.numByz = 0;
    this.sharingThreshold = this.numNodes;
    this.maxSimulationTimestamp = MAX_SIMULATION_TIMESTAMP_MS;
    this.networkPropagationMode = NETWORK_MODE;

  }

  abstract createNodes(): BaseNode[];

  abstract connectNodes(nodes: BaseNode[]): void;

  // abstract maxSimulationTimestampMs(): number;
  @bind
  maxSimulationTimestampMs(): number {
    return this.maxSimulationTimestamp;
  }

  // abstract getNetworkPropagationMode(): NetworkPropagationMode ;
  getNetworkPropagationMode(): NetworkPropagationMode  { return this.networkPropagationMode; }
  getNetworkConfiguration(): NetworkConfiguration {
    return OrbsScenario.getDefaultNetwork(this.numNodes);
  }

  static getDefaultNetwork(numNodes: number, etxSizeBytes: number = DEFAULT_ETX_SIZE_BYTES, numEtxsPerBlock: number = DEFAULT_NUM_ETX_PER_BLOCK, bandwidthBitsSec: number = DEFAULT_BANDWIDTH_BITS_SEC, defaultMsgSizeBytes: number = DEFAULT_MSG_SIZE_BYTES, etxShareBytes: number = DEFAULT_SHARE_SIZE_BYTES): NetworkConfiguration {
    const numRegions = 1;
    const nodeBandwidths: Array<number> = new Array(numNodes).fill(bandwidthBitsSec);
    const nodeRegions: Array<number> = new Array(numNodes).fill(0);
    const connectivityMatrix = [];
    for (const i of _.range(numRegions)) {
      connectivityMatrix[i] = [];
      for (const j of _.range(numRegions)) {
        connectivityMatrix[i][j] = { minDelayMs: NETWORK_MIN_DELAY_MS, maxDelayMs: NETWORK_MAX_DELAY_MS };
      }
    }
    const networkConfiguration = new NetworkConfiguration(nodeBandwidths, nodeRegions, connectivityMatrix, etxSizeBytes, numEtxsPerBlock, defaultMsgSizeBytes, etxShareBytes);
    return networkConfiguration;
  }


  log(str: string): void {
    const debugThreshold = this.logger.getDebugThreshold();
    this.logger.log(str, debugThreshold);
  }

  onScenarioEnd(): void {
    this.log("");
    this.log(`############## Final State ############# ${this.getNetworkPropagationMode()}`);
    this.log(`#Nodes/committee/Byz/threshold ${this.numNodes}/${this.committeeSize}/${this.numByz}/${this.sharingThreshold}`);
    this.log(`#warnings/errors/forks ${this.statistics.totalWarnings}/${this.statistics.totalErrors}/${(Statistics.hasForks(this) ? "yes" : "no")}`);
    this.log(`max timestamp/seed ${this.statistics.maxTimestampMs}/${this.seed}`);
    this.log(`closed blocks ${Statistics.minClosedBlocks(this) + " - " + Statistics.maxClosedBlocks(this)}`);
    this.log(`total sent messages ${this.statistics.totalSentMessages}`);
    this.log(`total bytes ${this.statistics.totalSentBytes}`);
    this.log(`messages/node ${(_.min(this.statistics.totalReceivedMessagesPerNode) || 0) + " - " + (_.max(this.statistics.totalReceivedMessagesPerNode) || 0)}`);
    this.log(`broadcasts ${this.statistics.totalBroadcasts}`);
    this.log(`unicasts ${this.statistics.totalUnicasts}`);
    this.log(`multicasts ${this.statistics.totalMulticasts}`);
  }
}

// hack required to be able to instantiate dynamic instances polymorphically
export class ScenarioModule extends OrbsScenario {
  createNodes(): BaseNode[] { return []; }
  connectNodes(nodes: BaseNode[]) {}
  maxSimulationTimestampMs() { return 0; }
  getNetworkPropagationMode() { return NetworkPropagationMode.Broadcast; }
  getNetworkConfiguration() { return OrbsScenario.getDefaultNetwork(1); }
}

export interface ConnectionParams {
  minDelayMs: number;
  maxDelayMs: number;
}

export class NetworkConfiguration {
  public nodeBandwidths: number[]; // nodeBandwidths[i] = bandwidth in bits / second of node i
  public nodeRegions: number[]; // nodeRegions[i]= region number of node i
  public connectivityMatrix: ConnectionParams[][]; // connectivityMatrix[i][j] min,max delay
  public etxSizeBytes: number;
  public etxShareBytes: number;
  public numEtxsPerBlock: number;
  public defaultMsgSizeBytes: number;

  constructor(nodeBandwidths: number[], nodeRegions: number[], connectivityMatrix: ConnectionParams[][], etxSizeBytes: number, numEtxsPerBlock: number, defaultMsgSizeBytes: number, etxShareBytes: number) {
    this.nodeBandwidths = nodeBandwidths;
    this.nodeRegions = nodeRegions;
    this.connectivityMatrix = connectivityMatrix;
    this.etxSizeBytes = etxSizeBytes;
    this.numEtxsPerBlock = numEtxsPerBlock;
    this.defaultMsgSizeBytes = defaultMsgSizeBytes;
    this.etxShareBytes = etxShareBytes;

  }

  @bind
  toString(): string {
    let str: string = "";
    str = str + (`nodeBandwidths: ${this.nodeBandwidths} \n`);
    str = str + (`nodeRegions: ${this.nodeRegions} \n`);
    str = str + (`connectivityMatrix: ${this.connectivityMatrix} \n`);
    str = str + (`etxSizeBytes: ${this.etxSizeBytes} \n`);
    str = str + (`numEtxsPerBlock: ${this.numEtxsPerBlock} \n`);
    str = str + (`defaultMsgSizeBytes: ${this.defaultMsgSizeBytes}\n`);
    str = str + (`etxShareBytes: ${this.etxShareBytes}\n`);
    return str;

  }

  @bind
  getMessageSize(msg: Message): number {
    const blockSize = (this.etxSizeBytes * this.numEtxsPerBlock);
    switch (Utils.getMessageTopType(msg.type)) {
      case "ConsensusMessage": {
        switch (msg.conMsgType) {
          case ConsensusMessageType.PrePrepare: {
            return blockSize + this.defaultMsgSizeBytes;
          }
          case ConsensusMessageType.NewView: {
            return blockSize + this.defaultMsgSizeBytes;
          }
          case ConsensusMessageType.Committed: {
            return blockSize + this.defaultMsgSizeBytes;
          }
          default: {
            return this.defaultMsgSizeBytes;
          }
        }
      }

      case "CryptoMessage": {
        switch (msg.cryptoMsgType) {
          case CryptoMessageType.BlockShare: {
            return (this.numEtxsPerBlock * this.etxShareBytes) + this.defaultMsgSizeBytes;
          }
          default: {
            return this.defaultMsgSizeBytes;
          }
        }
      }

      case "SyncMessage": {
        switch (msg.syncerMsgType) {
          case SyncerMessageType.SyncPeer: {
            return msg.blocks.length * blockSize + this.defaultMsgSizeBytes;
          }
          default: {
            return this.defaultMsgSizeBytes;
          }
        }
      }

      default: {
        return this.defaultMsgSizeBytes;
      }

    }
  }
}
