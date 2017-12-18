import * as _ from "lodash";
import BaseScenarioWithNode from "../BaseScenarioWithNode";
import BaseNode from "../../simulation/BaseNode";
import StableConstantDelay from "../../simulation/connections/StableConstantDelay";
import bind from "bind-decorator";

const NUM_NODES = 5;
const NETWORK_DELAY_MS = 50;
const MAX_SIMULATION_TIMESTAMP_MS = 10000;

export default class Scenario extends BaseScenarioWithNode {

  @bind
  createNodes(): BaseNode[] {
    return _.times(NUM_NODES, () => {
      return new this.Node(this);
    });
  }

  @bind
  connectNodes(nodes: BaseNode[]): void {
    for (const fromNode of nodes) {
      for (const toNode of nodes) {
        if (fromNode !== toNode) {
          const connection = new StableConstantDelay(this, toNode, NETWORK_DELAY_MS);
          fromNode.outgoingConnections.push(connection);
        }
      }
    }
  }

  @bind
  maxSimulationTimestampMs(): number {
    return MAX_SIMULATION_TIMESTAMP_MS;
  }

}
