import BaseScenario from "../simulation/BaseScenario";
import BaseNode, { NodeModule } from "../simulation/BaseNode";
import OrbsScenario from "../scenarios/oa-pbft/OrbsScenario";
import { NetworkConfiguration } from "../scenarios/oa-pbft/OrbsScenario";
import bind from "bind-decorator";
import { NetworkMode } from "../algorithms/oa-pbft/NetworkInterface";

export interface OrbsExpConfig {
  name: string;
  nNodesToCreate: number;
  committeeSize: number;
  numByz: number;
  sharingThreshold: number;
  faultyNodeName: string;
  networkConfiguration: NetworkConfiguration;
}

export default abstract class BaseOrbsScenarioWithNode extends OrbsScenario {
  protected Node: typeof NodeModule;
  protected TestNode: typeof NodeModule;
  protected FaultyNode: typeof NodeModule;
  public oaConfig: OrbsExpConfig;

  constructor(seed: string, Node: typeof NodeModule, TestNode: typeof NodeModule, FaultyNode: typeof NodeModule, oaConfig: OrbsExpConfig) {
    super(seed);
    this.oaConfig = oaConfig;
    this.Node = Node;
    this.TestNode = TestNode;
    this.FaultyNode = FaultyNode;
    this.committeeSize = oaConfig.committeeSize;
    this.numByz = oaConfig.numByz;
    this.sharingThreshold = oaConfig.sharingThreshold;

  }




  static configs(): OrbsExpConfig[] {
    return [];
  }

}

// hack required to be able to instantiate dynamic instances polymorphically
export class OrbsScenarioWithNodeModule extends BaseOrbsScenarioWithNode {
  createNodes(): BaseNode[] { return []; }
  connectNodes(nodes: BaseNode[]) {}
  configs() { return []; }
  maxSimulationTimestampMs() { return 0; }
  getNetworkMode() { return NetworkMode.Broadcast; }
  getNetworkConfiguration() { return { nodeBandwidths: [], nodeRegions: [], connectivityMatrix: [] }; }
}
