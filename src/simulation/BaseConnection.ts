import BaseNode from "./BaseNode";
import BaseScenario from "./BaseScenario";

export default abstract class BaseConnection {
  public from: BaseNode;
  public to: BaseNode;
  protected scenario: BaseScenario;
  public to_log: boolean;

  constructor(scenario: BaseScenario, from: BaseNode, to: BaseNode, to_log: boolean = false) {
    this.scenario = scenario;
    this.from = from;
    this.to = to;
    this.to_log = to_log;
  }

  abstract send(message: any): void;

}
