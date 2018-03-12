import * as _ from "lodash";
import BaseOrbsScenarioWithNode, { OrbsExpConfig } from "../BaseOrbsScenarioWithNode";
import BaseNode, { NodeModule } from "../../simulation/BaseNode";
import StableConstantDelay from "../../simulation/connections/StableConstantDelay";
import bind from "bind-decorator";


const NUM_NODES = [10];
const COMMITTEE_SIZES = [5]; // [5, 7];
const NUM_BYZ = 0;
const SHARING_THRESHOLDS = [0]; // [2, 4];
const NETWORK_DELAY_MS = 50;
const MAX_SIMULATION_TIMESTAMP_MS = 10000; // 10000;
const PHASE_TIMER_MS = 2000;
const FAULTY_NODE_NAME = "HonestNode";


export default class Scenario extends BaseOrbsScenarioWithNode {
  public oaConfig: OrbsExpConfig;

  constructor(seed: string, Node: typeof NodeModule, TestNode: typeof NodeModule, FaultyNode: typeof NodeModule, oaConfig: OrbsExpConfig) {
    super(seed, Node, TestNode, FaultyNode, oaConfig);
  }

  @bind
  createNodes(): BaseNode[] {
    return _.times(this.oaConfig.nNodesToCreate, () => {
      return new this.Node(this); // TODO change back to TestNode, but was getting errors when running oa_benchmark TypeError: this.TestNode is not a constructor
    });
  }

  @bind
  connectNodes(nodes: BaseNode[]): void {
    for (const fromNode of nodes) {
      for (const toNode of nodes) {
        if (fromNode !== toNode) {
          const connection = new StableConstantDelay(this, fromNode, toNode, NETWORK_DELAY_MS);
          fromNode.outgoingConnections.push(connection);
        }
      }
    }
  }


  @bind
  phaseTimeoutMs(): number {
    return PHASE_TIMER_MS;
  }

}
