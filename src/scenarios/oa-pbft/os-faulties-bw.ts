import * as _ from "lodash";
import OrbsScenarioFaulties from "./OrbsScenarioFaulties";
import { NetworkConfiguration } from "./OrbsScenario";
import BaseNode from "../../simulation/BaseNode";
import { HonestNode, FaultyForFewTermsNode, OrbsBaseNode } from "../../algorithms/oa-pbft";
import BandwidthConnection from "../../simulation/connections/BandwidthConnection";
import bind from "bind-decorator";
// import { NetworkMode } from "../../algorithms/oa-pbft/NetworkInterface";

const NUM_NODES = 10;
const COMMITTEE_SIZE = 7;
const NUM_BYZ = 2;
const SHARING_THRESHOLD = 3;
const NETWORK_MIN_DELAY_MS = 10;
const NETWORK_MAX_DELAY_MS = 370;
const NETWORK_PACKET_LOSS_PROBABILITY = 0.0;
const MAX_SIMULATION_TIMESTAMP_MS = 30000;
// const NETWORK_MODE = NetworkMode.Fastcast;

export default class Scenario extends OrbsScenarioFaulties {

  constructor(seed: string) {
    super(seed);
    this.committeeSize = COMMITTEE_SIZE;
    this.numByz = NUM_BYZ;
    this.sharingThreshold = SHARING_THRESHOLD;
    this.maxSimulationTimestamp = MAX_SIMULATION_TIMESTAMP_MS;

  }

  @bind
  createNodes(): OrbsBaseNode[] {
    const nodes = [];
    for (let i = 0; i < NUM_NODES; i++) {
      nodes.push(new HonestNode(this));
    }
    return nodes;
  }

  @bind
  connectNodes(nodes: OrbsBaseNode[]): void {
    const networkConfiguration = this.getNetworkConfiguration();
    for (const fromNode of nodes) {
      // set bandwidth according to network configuration
      fromNode.setBandwidth(networkConfiguration.nodeBandwidths[fromNode.nodeNumber - 1]);
      for (const toNode of nodes) {
        if (fromNode !== toNode) {
          const connectionParams = networkConfiguration.connectivityMatrix[networkConfiguration.nodeRegions[fromNode.nodeNumber - 1]][networkConfiguration.nodeRegions[toNode.nodeNumber - 1]];
          const connection = new BandwidthConnection(this, fromNode, toNode, connectionParams.minDelayMs, connectionParams.maxDelayMs);
          fromNode.outgoingConnections.push(connection);
        }
      }
    }
  }

  // @bind
  // maxSimulationTimestampMs(): number {
  //   return MAX_SIMULATION_TIMESTAMP_MS;
  // }

  // @bind
  // getNetworkMode(): NetworkMode {
  //   return NETWORK_MODE;
  // }

}
