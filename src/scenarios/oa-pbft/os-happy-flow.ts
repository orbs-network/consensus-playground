import * as _ from "lodash";
import OrbsScenario from "./OrbsScenario";
import BaseNode from "../../simulation/BaseNode";
import { HonestNode } from "../../algorithms/oa-pbft";
import StableConstantDelay from "../../simulation/connections/StableConstantDelay";
import bind from "bind-decorator";
import { NetworkPropagationMode } from "../../algorithms/oa-pbft/NetworkInterface";


const NUM_NODES = 100;
const COMMITTEE_SIZE = 30;
const NUM_BYZ = 3;
const SHARING_THRESHOLD = 4;
const NETWORK_DELAY_MS = 50;
const MAX_SIMULATION_TIMESTAMP_MS = 10000;
const NETWORK_MODE = NetworkPropagationMode.Fastcast;

export default class Scenario extends OrbsScenario {

  constructor(seed: string) {
    super(seed);
    this.committeeSize = COMMITTEE_SIZE;
    this.numByz = NUM_BYZ;
    this.sharingThreshold = SHARING_THRESHOLD;
    this.networkPropagationMode = NETWORK_MODE;

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

  // @bind
  // getNetworkMode(): NetworkMode {
  //   return NETWORK_MODE;
  // }


}
