import * as _ from "lodash";
import OrbsScenario from "./OrbsScenario";
import BaseNode from "../../simulation/BaseNode";
import { HonestNode, FaultyForFewTermsNode } from "../../algorithms/oa-pbft";
import RandomDelayAndPacketLoss from "../../simulation/connections/RandomDelayAndPacketLoss";
import bind from "bind-decorator";
// import { NetworkMode } from "../../algorithms/oa-pbft/NetworkInterface";

const NUM_NODES = 10;
const COMMITTEE_SIZE = 4;
const NUM_BYZ = 1;
const SHARING_THRESHOLD = 3;
const NETWORK_MIN_DELAY_MS = 5;
const NETWORK_MAX_DELAY_MS = 250;
const NETWORK_PACKET_LOSS_PROBABILITY = 0.0;
const MAX_SIMULATION_TIMESTAMP_MS = 10000;
// const NETWORK_MODE = NetworkMode.Broadcast;

export default class Scenario extends OrbsScenario {

  constructor(seed: string) {
    super(seed);
    this.committeeSize = COMMITTEE_SIZE;
    this.numByz = NUM_BYZ;
    this.sharingThreshold = SHARING_THRESHOLD;

  }

  @bind
  createNodes(): BaseNode[] {
    const nodes = [];
    for (let i = 0; i < NUM_NODES - NUM_BYZ; i++) {
      nodes.push(new HonestNode(this));
    }
    for (let i = 0; i < NUM_BYZ; i++) {
      nodes.push(new FaultyForFewTermsNode(this));
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
