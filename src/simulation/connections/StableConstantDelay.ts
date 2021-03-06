import BaseConnection from "../BaseConnection";
import Endpoint from "../Endpoint";
import BaseScenario from "../BaseScenario";
import BaseNode from "../BaseNode";
import MessageEvent from "../events/MessageEvent";
import bind from "bind-decorator";

export default class StableConstantDelay extends BaseConnection {
  protected delayMs: number;

  constructor(scenario: BaseScenario, from: Endpoint, to: Endpoint, delayMs: number, to_log: boolean = false) {
    super(scenario, from, to, to_log);
    this.delayMs = delayMs;
  }

  @bind
  send(message: any): void {
    const timestamp = this.scenario.currentTimestamp + this.delayMs;
    const event = new MessageEvent(timestamp, this.to, message);
    this.scenario.postEvent(event);
    this.scenario.statistics.recordActiveConnection(timestamp, this.from, this.to, message);
  }

}
