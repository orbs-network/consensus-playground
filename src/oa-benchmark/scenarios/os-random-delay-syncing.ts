import * as _ from "lodash";
import BaseOrbsScenarioWithNode from "../BaseOrbsScenarioWithNode";
import BaseNode, { NodeModule } from "../../simulation/BaseNode";
import RandomDelayAndPacketLoss from "../../simulation/connections/RandomDelayAndPacketLoss";
import BandwidthConnection from "../../simulation/connections/BandwidthConnection";
import bind from "bind-decorator";
import { NetworkPropagationMode } from "../../algorithms/oa-pbft/NetworkInterface";
import OrbsBaseNode from "../../algorithms/oa-pbft/OrbsBaseNode";
import OrbsScenario, { OrbsExpConfig } from "../../scenarios/oa-pbft/OrbsScenario";


const NUM_NODES = [10];
const COMMITTEE_SIZES = [7];
const NUM_BYZ = [0, 1, 2, 3];
const SHARING_THRESHOLDS = [5];
const NETWORK_MIN_DELAY_MS = 5;
const NETWORK_MAX_DELAY_MS = 100;
const NETWORK_PACKET_LOSS_PROBABILITY = 0.0;
const MAX_SIMULATION_TIMESTAMP_MS = 10000;
const FAULTY_NODE_NAME = "FaultyForFewTermsNode";
const NETWORK_MODE = NetworkPropagationMode.Fastcast;

export default class Scenario extends BaseOrbsScenarioWithNode {

  constructor(seed: string, Node: typeof NodeModule, TestNode: typeof NodeModule, FaultyNode: typeof NodeModule, oaConfig: OrbsExpConfig) {
    super(seed, Node, TestNode, FaultyNode, oaConfig);
  }

  @bind
  createNodes(): BaseNode[] {
    const nodes = [];
    for (let i = 0; i < this.oaConfig.nNodesToCreate; i++) {
      if (i < this.oaConfig.nNodesToCreate - this.oaConfig.numByz) nodes.push(new this.Node(this));
      else nodes.push(new this.FaultyNode(this));
    }
    return nodes;
  }

  @bind
  connectNodes(nodes: OrbsBaseNode[]): void {
    const networkConfiguration = this.getNetworkConfiguration();
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
            const committeeSize = Math.min(m, n);
            const numByz = Math.min(committeeSize, b);
            const oaConfig: OrbsExpConfig = { name: `${c}`, nNodesToCreate: n, committeeSize: committeeSize, numByz: numByz, sharingThreshold: Math.min(k, n), faultyNodeName: FAULTY_NODE_NAME, networkConfiguration: OrbsScenario.getDefaultNetwork(n) };
            oaConfigs.push(oaConfig);
            c++;
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
