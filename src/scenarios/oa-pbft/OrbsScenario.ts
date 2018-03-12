import * as _ from "lodash";
import BaseNode from "../../simulation/BaseNode";
import BaseScenario from "../../simulation/BaseScenario";
import { NetworkPropagationMode } from "../../algorithms/oa-pbft/NetworkInterface";
import bind from "bind-decorator";
import Statistics from "../../simulation/Statistics";


const MAX_SIMULATION_TIMESTAMP_MS = 100;
const NETWORK_MODE = NetworkPropagationMode.Broadcast;

export default abstract class OrbsScenario extends BaseScenario {
  public committeeSize: number;
  public numByz: number;
  public sharingThreshold: number;
  public maxSimulationTimestamp: number;
  protected seed: string;
  protected networkPropagationMode: NetworkPropagationMode;


  constructor(seed: string) {
    super(seed);
    this.seed = seed;
    this.committeeSize = this.numNodes;
    this.numByz = 0;
    this.sharingThreshold = this.numNodes;
    this.maxSimulationTimestamp = MAX_SIMULATION_TIMESTAMP_MS;
    this.networkPropagationMode = NETWORK_MODE;

  }

  abstract createNodes(): BaseNode[];

  abstract connectNodes(nodes: BaseNode[]): void;

  // abstract maxSimulationTimestampMs(): number;
  @bind
  maxSimulationTimestampMs(): number {
    return this.maxSimulationTimestamp;
  }

  // abstract getNetworkPropagationMode(): NetworkPropagationMode ;
  getNetworkPropagationMode(): NetworkPropagationMode  { return this.networkPropagationMode; }

  log(str: string): void {
    const debugThreshold = this.logger.getDebugThreshold();
    this.logger.log(str, debugThreshold);
  }

  onScenarioEnd(): void {
    this.log("");
    this.log(`############## Final State ############# ${this.getNetworkPropagationMode()}`);
    this.log(`#Nodes/committee/Byz/threshold ${this.numNodes}/${this.committeeSize}/${this.numByz}/${this.sharingThreshold}`);
    this.log(`#warnings/errors/forks ${this.statistics.totalWarnings}/${this.statistics.totalErrors}/${(Statistics.hasForks(this) ? "yes" : "no")}`);
    this.log(`max timestamp/seed ${this.statistics.maxTimestampMs}/${this.seed}`);
    this.log(`closed blocks ${Statistics.minClosedBlocks(this) + " - " + Statistics.maxClosedBlocks(this)}`);
    this.log(`total sent messages ${this.statistics.totalSentMessages}`);
    this.log(`total bytes ${this.statistics.totalSentBytes}`);
    this.log(`messages/node ${(_.min(this.statistics.totalReceivedMessagesPerNode) || 0) + " - " + (_.max(this.statistics.totalReceivedMessagesPerNode) || 0)}`);
    this.log(`broadcasts ${this.statistics.totalBroadcasts}`);
    this.log(`unicasts ${this.statistics.totalUnicasts}`);
    this.log(`multicasts ${this.statistics.totalMulticasts}`);
  }
}

// hack required to be able to instantiate dynamic instances polymorphically
export class ScenarioModule extends OrbsScenario {
  createNodes(): BaseNode[] { return []; }
  connectNodes(nodes: BaseNode[]) {}
  maxSimulationTimestampMs() { return 0; }
  getNetworkPropagationMode() { return NetworkPropagationMode.Broadcast; }
}