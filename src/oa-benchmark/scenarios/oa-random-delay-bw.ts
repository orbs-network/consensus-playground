import * as _ from "lodash";
import BaseOrbsScenarioWithNode from "../BaseOrbsScenarioWithNode";
import BaseNode, { NodeModule } from "../../simulation/BaseNode";
import RandomDelayAndPacketLoss from "../../simulation/connections/RandomDelayAndPacketLoss";
import BandwidthConnection from "../../simulation/connections/BandwidthConnection";
import bind from "bind-decorator";
import { NetworkPropagationMode } from "../../algorithms/oa-pbft/NetworkInterface";
import OrbsBaseNode from "../../algorithms/oa-pbft/OrbsBaseNode";
import OrbsScenario, { OrbsExpConfig } from "../../scenarios/oa-pbft/OrbsScenario";


const NUM_NODES = [10, 20, 30, 50];
const COMMITTEE_SIZES = [7, 10, 15, 20];
const NUM_BYZ = [0, 1, 2, 3]; // these won't actually be faulty, but used to determine f.
const SHARING_THRESHOLDS = [5];
const ETX_SIZES_BYTES = [250, 500];
const NUM_ETXS_PER_BLOCK = [1000, 5000];
const NODE_BW_BITS_SEC = [1000000000, 500000000, 100000000];
const MAX_SIMULATION_TIMESTAMP_MS = 10000;
const FAULTY_NODE_NAME = "HonestNode";
const NETWORK_MODE = NetworkPropagationMode.Fastcast;


export default class Scenario extends BaseOrbsScenarioWithNode {

  constructor(seed: string, Node: typeof NodeModule, TestNode: typeof NodeModule, FaultyNode: typeof NodeModule, oaConfig: OrbsExpConfig) {
    super(seed, Node, TestNode, FaultyNode, oaConfig);
  }

  @bind
  createNodes(): BaseNode[] {
    const nodes = [];
    for (let i = 0; i < this.oaConfig.nNodesToCreate; i++) {
      nodes.push(new this.Node(this)); // no faulty nodes currently;
    }
    return nodes;
  }

  @bind
  connectNodes(nodes: OrbsBaseNode[]): void {
    const networkConfiguration = this.oaConfig.networkConfiguration;
    console.log(`${this.oaConfig.networkConfiguration.toString()}`);
    for (const fromNode of nodes) {
      // set bandwidth according to network configuration
      fromNode.setBandwidth(networkConfiguration.nodeBandwidths[fromNode.nodeNumber - 1]);
      for (const toNode of nodes) {
        if (fromNode !== toNode) {
          const connectionParams = networkConfiguration.connectivityMatrix[networkConfiguration.nodeRegions[fromNode.nodeNumber - 1]][networkConfiguration.nodeRegions[toNode.nodeNumber - 1]];
          const connection = new BandwidthConnection(this, fromNode, toNode, connectionParams.minDelayMs, connectionParams.maxDelayMs);
          fromNode.outgoingConnections.push(connection);
        }
      }
    }
  }



  static configs(): OrbsExpConfig[] {
    const oaConfigs: OrbsExpConfig[] = [];
    let c = 1;
    for (const n of NUM_NODES) {
      for (const m of COMMITTEE_SIZES) {
        for (const k of SHARING_THRESHOLDS) {
          for (const b of NUM_BYZ) {
            for (const e of ETX_SIZES_BYTES) {
              for (const num_etxs of NUM_ETXS_PER_BLOCK) {
                  for (const bw_bits of NODE_BW_BITS_SEC) {
                  const committeeSize = Math.min(m, n);
                  const numByz = Math.min(committeeSize, b);
                  const oaConfig: OrbsExpConfig = { name: `${c}`, nNodesToCreate: n, committeeSize: committeeSize, numByz: numByz, sharingThreshold: Math.min(k, n), faultyNodeName: FAULTY_NODE_NAME, networkConfiguration: OrbsScenario.getDefaultNetwork(n, e, num_etxs, bw_bits) };
                  oaConfigs.push(oaConfig);
                  c++;
                }
              }
            }
          }
        }
      }
    }
    return oaConfigs;
  }

  @bind
  maxSimulationTimestampMs(): number {
    return MAX_SIMULATION_TIMESTAMP_MS;
  }

  @bind
  getNetworkMode(): NetworkPropagationMode {
    return NETWORK_MODE;
  }
}
