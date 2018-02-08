import * as _ from "lodash";
import BaseScenario from "../../simulation/BaseScenario";
import BaseNode from "../../simulation/BaseNode";
import { HonestNode, FaultyNode, FaultyPreparedNode } from "../../algorithms/oa-pbft";
import RandomDelayAndPacketLoss from "../../simulation/connections/RandomDelayAndPacketLoss";
import bind from "bind-decorator";

const NUM_GOOD_NODES = 2;
const NUM_NODES = 5;
const NETWORK_DELAY_MS = 50;
const NETWORK_MIN_DELAY_MS = 5;
const NETWORK_MAX_DELAY_MS = 250;
const NETWORK_PACKET_LOSS_PROBABILITY = 0.0;
const MAX_SIMULATION_TIMESTAMP_MS = 30000;

export default class Scenario extends BaseScenario {

  @bind
  createNodes(): BaseNode[] {
    const nodes = [];
    for (let i = 0; i < NUM_NODES; i++) {
      if (i < NUM_GOOD_NODES) nodes.push(new HonestNode(this));
      else nodes.push(new FaultyPreparedNode(this));
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

  @bind
  maxSimulationTimestampMs(): number {
    return MAX_SIMULATION_TIMESTAMP_MS;
  }

}