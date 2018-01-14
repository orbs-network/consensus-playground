import BaseNode from "./BaseNode";
import BaseScenario from "./BaseScenario";
import Endpoint from "./Endpoint";


export default abstract class BaseConnection {
  public from: Endpoint;
  public to: Endpoint;
  protected scenario: BaseScenario;
  public to_log: boolean;


  constructor(scenario: BaseScenario, from: any, to: any, to_log: boolean = false) {
    this.scenario = scenario;
    this.from = from;
    this.to = to;
    this.to_log = to_log;
  }

  abstract send(message: any): void;

}
