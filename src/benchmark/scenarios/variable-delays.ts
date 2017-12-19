import * as _ from "lodash";
import BaseScenarioWithNode from "../BaseScenarioWithNode";
import BaseNode from "../../simulation/BaseNode";
import RandomDelayAndPacketLoss from "../../simulation/connections/RandomDelayAndPacketLoss";
import bind from "bind-decorator";

const NUM_NODES = 5;
const NETWORK_DELAY_MIN_MS = 5;
const NETWORK_DELAY_MAX_MS = 500;
const MAX_SIMULATION_TIMESTAMP_MS = 100000;

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
          const connection = new RandomDelayAndPacketLoss(this, toNode, NETWORK_DELAY_MIN_MS, NETWORK_DELAY_MAX_MS, 0);
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
