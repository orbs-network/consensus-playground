import * as _ from "lodash";
import BaseOrbsScenarioWithNode, { OrbsExpConfig } from "../BaseOrbsScenarioWithNode";
import BaseNode, { NodeModule } from "../../simulation/BaseNode";
import RandomDelayAndPacketLoss from "../../simulation/connections/RandomDelayAndPacketLoss";
import bind from "bind-decorator";
import { NetworkMode } from "../../algorithms/oa-pbft/NetworkInterface";


const NUM_NODES = [10];
const COMMITTEE_SIZES = [7];
const NUM_BYZ = [0, 1, 2, 3];
const SHARING_THRESHOLDS = [5];
const NETWORK_MIN_DELAY_MS = 5;
const NETWORK_MAX_DELAY_MS = 100;
const NETWORK_PACKET_LOSS_PROBABILITY = 0.0;
const MAX_SIMULATION_TIMESTAMP_MS = 10000;
const FAULTY_NODE_NAME = "FaultyForFewTermsNode";
const NETWORK_MODE = NetworkMode.Broadcast;

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
  connectNodes(nodes: BaseNode[]): void {
    for (const fromNode of nodes) {
      for (const toNode of nodes) {
        if (fromNode !== toNode) {
          const connection = new RandomDelayAndPacketLoss(this, fromNode, toNode, NETWORK_MIN_DELAY_MS, NETWORK_MAX_DELAY_MS, NETWORK_PACKET_LOSS_PROBABILITY);
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
            const oaConfig: OrbsExpConfig = { name: `${c}`, nNodesToCreate: n, committeeSize: committeeSize, numByz: numByz, sharingThreshold: Math.min(k, n), faultyNodeName: FAULTY_NODE_NAME };
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
  getNetworkMode(): NetworkMode {
    return NETWORK_MODE;
  }

}
