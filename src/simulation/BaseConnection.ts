import BaseNode from "./BaseNode";
import BaseScenario from "./BaseScenario";

export default abstract class BaseConnection {
  public from: BaseNode;
  public to: BaseNode;
  protected scenario: BaseScenario;

  constructor(scenario: BaseScenario, from: BaseNode, to: BaseNode) {
    this.scenario = scenario;
    this.from = from;
    this.to = to;
  }

  abstract send(message: any): void;

}
