import * as _ from "lodash";
import BaseNode from "../../simulation/BaseNode";
import BaseScenario from "../../simulation/BaseScenario";
import { NetworkMode } from "../../algorithms/oa-pbft/NetworkInterface";
import bind from "bind-decorator";

const DEFAULT_BANDWIDTH_BITS_SEC = 1000000;
const NETWORK_MIN_DELAY_MS = 10;
const NETWORK_MAX_DELAY_MS = 370;

export default abstract class OrbsScenario extends BaseScenario {
  public committeeSize: number;
  public numByz: number;
  public sharingThreshold: number;

  constructor(seed: string) {
    super(seed);
    this.committeeSize = this.numNodes;
    this.numByz = this.numNodes;
    this.sharingThreshold = this.numNodes;

  }

  abstract createNodes(): BaseNode[];

  abstract connectNodes(nodes: BaseNode[]): void;

  abstract maxSimulationTimestampMs(): number;

  abstract getNetworkMode(): NetworkMode ;

  getNetworkConfiguration(): NetworkConfiguration {
    return OrbsScenario.getDefaultNetwork(this.numNodes);
  }

  static getDefaultNetwork(numNodes: number): NetworkConfiguration {
    const numRegions = 1;
    const nodeBandwidths: Array<number> = new Array(numNodes).fill(DEFAULT_BANDWIDTH_BITS_SEC);
    const nodeRegions: Array<number> = new Array(numNodes).fill(0);
    const connectivityMatrix = [];
    for (const i of _.range(numRegions)) {
      connectivityMatrix[i] = [];
      for (const j of _.range(numRegions)) {
        connectivityMatrix[i][j] = { minDelayMs: NETWORK_MIN_DELAY_MS, maxDelayMs: NETWORK_MAX_DELAY_MS };
      }
    }
    const networkConfiguration = { nodeBandwidths: nodeBandwidths, nodeRegions: nodeRegions, connectivityMatrix: connectivityMatrix };
    return networkConfiguration;
  }



}

// hack required to be able to instantiate dynamic instances polymorphically
export class ScenarioModule extends OrbsScenario {
  createNodes(): BaseNode[] { return []; }
  connectNodes(nodes: BaseNode[]) {}
  maxSimulationTimestampMs() { return 0; }
  getNetworkMode() { return NetworkMode.Broadcast; }
  getNetworkConfiguration() { return { nodeBandwidths: [], nodeRegions: [], connectivityMatrix: [] }; }
}

export interface ConnectionParams {
  minDelayMs: number;
  maxDelayMs: number;
}

export interface NetworkConfiguration {
  nodeBandwidths: number[]; // nodeBandwidths[i] = bandwidth in bits / second of node i
  nodeRegions: number[]; // nodeRegions[i]= region number of node i
  connectivityMatrix: ConnectionParams[][]; // connectivityMatrix[i][j] min,max delay
}
