import * as _ from "lodash";
import BaseScenario from "../simulation/BaseScenario";
import BaseNode, { NodeModule } from "../simulation/BaseNode";
import OrbsScenarioFaulties from "../scenarios/oa-pbft/OrbsScenarioFaulties";
import { OrbsExpConfig } from "../scenarios/oa-pbft/OrbsScenario";
import { NetworkConfiguration } from "../scenarios/oa-pbft/OrbsScenario";
import bind from "bind-decorator";
import { NetworkPropagationMode } from "../algorithms/oa-pbft/NetworkInterface";




const NUM_NODES = [10];
const COMMITTEE_SIZES = [4]; // [5, 7];
const NUM_BYZ = 0;
const SHARING_THRESHOLDS = [2]; // [2, 4];
const NETWORK_DELAY_MS = 50;
const MAX_SIMULATION_TIMESTAMP_MS = 10000;
const NETWORK_MODE = NetworkPropagationMode.Fastcast;


export default class BaseOrbsScenarioFaultiesWithNode extends OrbsScenarioFaulties {
  protected Node: typeof NodeModule;
  protected TestNode: typeof NodeModule;
  protected FaultyNode: typeof NodeModule;


  constructor(seed: string, Node: typeof NodeModule, TestNode: typeof NodeModule, FaultyNode: typeof NodeModule, oaConfig: OrbsExpConfig) {
    super(seed, oaConfig);
    this.Node = Node;
    this.TestNode = TestNode;
    this.FaultyNode = FaultyNode;
    this.committeeSize = oaConfig.committeeSize;
    this.numByz = oaConfig.numByz;
    this.sharingThreshold = oaConfig.sharingThreshold;
  }


  public static configs(): OrbsExpConfig[] {
    const oaConfigs: OrbsExpConfig[] = [];
    return oaConfigs;
  }

  @bind
  createNodes(): BaseNode[] { return []; }

  @bind
  connectNodes(nodes: BaseNode[]): void { }

  @bind
  maxSimulationTimestampMs(): number {
    return MAX_SIMULATION_TIMESTAMP_MS;
  }

  @bind
  getNetworkPropagationMode(): NetworkPropagationMode {
    return NETWORK_MODE;
  }

}

  // hack required; to be; able to; instantiate dynamic; instances polymorphically;
  export class OrbsScenarioFaultiesWithNodeModule extends BaseOrbsScenarioFaultiesWithNode {
    createNodes(): BaseNode[] { return []; }
    connectNodes(nodes: BaseNode[]) {}
    configs() { return []; }
    maxSimulationTimestampMs() { return 0; }
    getNetworkMode() { return NetworkPropagationMode.Broadcast; }

}


// }
