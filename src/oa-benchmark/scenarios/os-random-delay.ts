import * as _ from "lodash";
import BaseOrbsScenarioWithNode, { OrbsExpConfig } from "../BaseOrbsScenarioWithNode";
import BaseNode, { NodeModule } from "../../simulation/BaseNode";
import RandomDelayAndPacketLoss from "../../simulation/connections/RandomDelayAndPacketLoss";
import bind from "bind-decorator";

const NUM_NODES = [10];
const COMMITTEE_SIZES = [5];
const NUM_BYZ = 0;
const SHARING_THRESHOLDS = [2, 4, 8];
const NETWORK_MIN_DELAY_MS = 5;
const NETWORK_MAX_DELAY_MS = 100;
const NETWORK_PACKET_LOSS_PROBABILITY = 0.0;
const MAX_SIMULATION_TIMESTAMP_MS = 10000;

export default class Scenario extends BaseOrbsScenarioWithNode {
  public oaConfig: OrbsExpConfig;

  constructor(seed: string, Node: typeof NodeModule, oaConfig: OrbsExpConfig) {
    super(seed, Node, oaConfig);
    this.oaConfig = oaConfig;
  }

  @bind
  createNodes(): BaseNode[] {
    return _.times(this.oaConfig.nNodesToCreate, () => {
      return new this.Node(this);
    });
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
          const oaConfig: OrbsExpConfig = { name: `${c}`, nNodesToCreate: n, commiteeSize: Math.min(m, n), numByz: NUM_BYZ, sharingThreshold: Math.min(k, n) };
          oaConfigs.push(oaConfig);
          c++;
        }
      }
    }
    return oaConfigs;
  }

  @bind
  maxSimulationTimestampMs(): number {
    return MAX_SIMULATION_TIMESTAMP_MS;
  }

}
