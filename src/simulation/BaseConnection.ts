import BaseNode from "./BaseNode";
import BaseScenario from "./BaseScenario";

export default abstract class BaseConnection {
  public to: BaseNode;
  protected scenario: BaseScenario;

  constructor(scenario: BaseScenario, to: BaseNode) {
    this.scenario = scenario;
    this.to = to;
  }

  abstract send(message: any): void;

}
