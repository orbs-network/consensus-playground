import * as _ from "lodash";
import BaseNode from "../../simulation/BaseNode";
import { HonestNode, FaultyNode } from "../../algorithms/oa-pbft";
import RandomDelayAndPacketLoss from "../../simulation/connections/RandomDelayAndPacketLoss";
import bind from "bind-decorator";
// import { NetworkMode } from "../../algorithms/oa-pbft/NetworkInterface";
import OrbsScenario from "./OrbsScenario";



const NUM_NODES = 5;
const NETWORK_MIN_DELAY_MS = 5;
const NETWORK_MAX_DELAY_MS = 250;
const NETWORK_PACKET_LOSS_PROBABILITY = 0.0;
const MAX_SIMULATION_TIMESTAMP_MS = 30000;
// const NETWORK_MODE = NetworkMode.Broadcast;

export default class Scenario extends OrbsScenario {

  @bind
  createNodes(): BaseNode[] {
    const nodes = [];
    for (let i = 0; i < NUM_NODES ; i++) {
      nodes.push(new HonestNode(this));
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

  // @bind
  // getNetworkMode(): NetworkMode {
  //   return NETWORK_MODE;
  // }

}
