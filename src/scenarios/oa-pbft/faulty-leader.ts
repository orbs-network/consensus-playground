import * as _ from "lodash";
import BaseScenario from "../../simulation/BaseScenario";
import BaseNode from "../../simulation/BaseNode";
import { HonestNode, FaultyNode } from "../../algorithms/oa-pbft";
import StableConstantDelay from "../../simulation/connections/StableConstantDelay";
import bind from "bind-decorator";

const NUM_NODES = 5;
const NETWORK_DELAY_MS = 50;
const MAX_SIMULATION_TIMESTAMP_MS = 30000;

export default class Scenario extends BaseScenario {

  @bind
  createNodes(): BaseNode[] {
    const nodes = [];
    for (let i = 0; i < NUM_NODES - 1; i++) {
      nodes.push(new HonestNode(this));
    }
    // const nodes = _.times(NUM_NODES - 1, () => {
    //   return new HonestNode(this);
    // });
    nodes.push( new FaultyNode(this));
    return nodes;
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
  maxSimulationTimestampMs(): number {
    return MAX_SIMULATION_TIMESTAMP_MS;
  }

}
