import * as _ from "lodash";
import { OrbsScenario } from "./OrbsScenario";
import BaseNode from "../../simulation/BaseNode";
import { HonestNode } from "../../algorithms/oa-pbft";
import RandomDelayAndPacketLoss from "../../simulation/connections/RandomDelayAndPacketLoss";
import bind from "bind-decorator";

const NUM_NODES = 10;
const COMMITTEE_SIZE = 5;
const NUM_BYZ = 0;
const SHARING_THRESHOLD = 4;
const NETWORK_MIN_DELAY_MS = 5;
const NETWORK_MAX_DELAY_MS = 250;
const NETWORK_PACKET_LOSS_PROBABILITY = 0.0;
const MAX_SIMULATION_TIMESTAMP_MS = 10000;

export default class Scenario extends OrbsScenario {

  constructor(seed: string) {
    super(seed);
    this.committeeSize = COMMITTEE_SIZE;
    this.numByz = NUM_BYZ;
    this.sharingThreshold = SHARING_THRESHOLD;

  }

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
