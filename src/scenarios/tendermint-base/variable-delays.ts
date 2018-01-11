import * as _ from "lodash";
import BaseScenarioWithNode from "../../benchmark/BaseScenarioWithNode";

import BaseNode from "../../simulation/BaseNode";
import { HonestNode } from "../../algorithms/tendermint-base";
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
      return new HonestNode(this);
    });
  }

  @bind
  connectNodes(nodes: BaseNode[]): void {
    for (const fromNode of nodes) {
      for (const toNode of nodes) {
        if (fromNode !== toNode) {
          const connection = new RandomDelayAndPacketLoss(this, fromNode, toNode, NETWORK_DELAY_MIN_MS, NETWORK_DELAY_MAX_MS, 0, false);
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
