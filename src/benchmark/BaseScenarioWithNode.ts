import BaseScenario from "../simulation/BaseScenario";
import BaseNode, { NodeModule } from "../simulation/BaseNode";
import bind from "bind-decorator";

export default abstract class BaseScenarioWithNode extends BaseScenario {
  protected Node: typeof NodeModule;

  constructor(seed: string, Node: typeof NodeModule) {
    super(seed);
    this.Node = Node;
  }

}

// hack required to be able to instantiate dynamic instances polymorphically
export class ScenarioWithNodeModule extends BaseScenarioWithNode {
  createNodes(): BaseNode[] { return []; }
  connectNodes(nodes: BaseNode[]) {}
  maxSimulationTimestampMs() { return 0; }
}
