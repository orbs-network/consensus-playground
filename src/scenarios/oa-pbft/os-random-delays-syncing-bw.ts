import * as _ from "lodash";
import OrbsScenario from "./OrbsScenario";
import BaseNode from "../../simulation/BaseNode";
import { HonestNode, FaultyForFewTermsNode } from "../../algorithms/oa-pbft";
import BandwidthConnection from "../../simulation/connections/BandwidthConnection";
import bind from "bind-decorator";
import { NetworkMode } from "../../algorithms/oa-pbft/NetworkInterface";

const NUM_NODES = 10;
const COMMITTEE_SIZE = 7;
const NUM_BYZ = 2;
const SHARING_THRESHOLD = 3;
const NETWORK_MIN_DELAY_MS = 10;
const NETWORK_MAX_DELAY_MS = 370;
const NETWORK_PACKET_LOSS_PROBABILITY = 0.0;
const MAX_SIMULATION_TIMESTAMP_MS = 10000;
const NETWORK_MODE = NetworkMode.Fastcast;

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
          const connection = new BandwidthConnection(this, fromNode, toNode, NETWORK_MIN_DELAY_MS, NETWORK_MAX_DELAY_MS);
          fromNode.outgoingConnections.push(connection);
        }
      }
    }
  }

  @bind
  maxSimulationTimestampMs(): number {
    return MAX_SIMULATION_TIMESTAMP_MS;
  }

  @bind
  getNetworkMode(): NetworkMode {
    return NETWORK_MODE;
  }

}
