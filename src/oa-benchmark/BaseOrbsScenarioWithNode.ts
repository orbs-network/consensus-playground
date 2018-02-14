import BaseScenario from "../simulation/BaseScenario";
import BaseNode, { NodeModule } from "../simulation/BaseNode";
import { OrbsScenario } from "../scenarios/oa-pbft/OrbsScenario";
import bind from "bind-decorator";

export interface OrbsExpConfig {
  name: string;
  nNodesToCreate: number;
  commiteeSize: number;
  numByz: number;
  sharingThreshold: number;
}

export default abstract class BaseOrbsScenarioWithNode extends OrbsScenario {
  protected Node: typeof NodeModule;
  protected FaultyNode: typeof NodeModule;
  public oaConfig: OrbsExpConfig;

  constructor(seed: string, Node: typeof NodeModule, FaultyNode: typeof NodeModule, oaConfig: OrbsExpConfig) {
    super(seed);
    this.oaConfig = oaConfig;
    this.Node = Node;
    this.FaultyNode = FaultyNode;
    this.committeeSize = oaConfig.commiteeSize;
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
}
