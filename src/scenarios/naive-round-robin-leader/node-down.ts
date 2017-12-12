import * as _ from "lodash";
import BaseScenario from "../../simulation/BaseScenario";
import BaseNode from "../../simulation/BaseNode";
import { HonestNode } from "../../algorithms/naive-round-robin-leader";
import StableConstantDelay from "../../simulation/connections/StableConstantDelay";
import OnOffConstantDelay from "../../simulation/connections/OnOffConstantDelay";
import bind from "bind-decorator";

const NUM_NODES = 4;
const NETWORK_DELAY_MS = 50;
const MAX_SIMULATION_TIMESTAMP_MS = 8000;

export default class Scenario extends BaseScenario {

  @bind
  createNodes(): BaseNode[] {
    return _.times(NUM_NODES, () => {
      return new HonestNode(this);
    });
  }

  @bind
  connectNodes(nodes: BaseNode[]): void {
    for (const fromNode of nodes) {
      for (const toNode of nodes) {
        if (fromNode !== toNode) {
          if (toNode.nodeNumber === 4 || fromNode.nodeNumber === 4) {
            const connection = new OnOffConstantDelay(this, toNode, NETWORK_DELAY_MS, false, []);
            fromNode.outgoingConnections.push(connection);
          } else {
            const connection = new StableConstantDelay(this, toNode, NETWORK_DELAY_MS);
            fromNode.outgoingConnections.push(connection);
          }
        }
      }
    }
  }

  @bind
  maxSimulationTimestampMs(): number {
    return MAX_SIMULATION_TIMESTAMP_MS;
  }

}
