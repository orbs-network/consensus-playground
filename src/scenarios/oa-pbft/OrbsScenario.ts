import BaseNode from "../../simulation/BaseNode";
import BaseScenario from "../../simulation/BaseScenario";

import bind from "bind-decorator";

export abstract class OrbsScenario extends BaseScenario {
  public committeeSize: number;
  public numByz: number;
  public sharingThreshold: number;

  constructor(seed: string) {
    super(seed);
    this.committeeSize = this.numNodes;
    this.numByz = this.numNodes;
    this.sharingThreshold = this.numNodes;

  }

  abstract createNodes(): BaseNode[];

  abstract connectNodes(nodes: BaseNode[]): void;

  abstract maxSimulationTimestampMs(): number;



}

// hack required to be able to instantiate dynamic instances polymorphically
export class ScenarioModule extends OrbsScenario {
  createNodes(): BaseNode[] { return []; }
  connectNodes(nodes: BaseNode[]) {}
  maxSimulationTimestampMs() { return 0; }
}
