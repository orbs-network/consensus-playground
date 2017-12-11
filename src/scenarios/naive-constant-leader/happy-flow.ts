import * as _ from "lodash";
import BaseScenario from "../../simulation/BaseScenario";
import BaseNode from "../../simulation/BaseNode";
import { HonestNode } from "../../algorithms/naive-constant-leader";
import StableConstantDelay from "../../simulation/connections/StableConstantDelay";
import bind from "bind-decorator";

const NUM_NODES = 3;
const NETWORK_DELAY_MS = 50;

export default class Scenario extends BaseScenario {

  @bind
  createNodes(): BaseNode[] {
    return _.times(NUM_NODES, () => {
      return new HonestNode(this)
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

}
