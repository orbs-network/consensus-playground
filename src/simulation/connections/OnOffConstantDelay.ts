import BaseConnection from "../BaseConnection";
import BaseScenario from "../BaseScenario";
import BaseNode from "../BaseNode";
import MessageEvent from "../events/MessageEvent";
import bind from "bind-decorator";

export default class StableConstantDelay extends BaseConnection {
  protected delayMs: number;
  protected startsOn: boolean;
  protected changesMs: number[];

  constructor(scenario: BaseScenario, from: BaseNode, to: BaseNode, delayMs: number, startsOn: boolean, changesMs: number[]) {
    super(scenario, from, to);
    this.delayMs = delayMs;
    this.startsOn = startsOn;
    this.changesMs = changesMs;
  }

  @bind
  isOnAtTimestamp(timestamp: number): boolean {
    let currentOn = this.startsOn;
    for (const change of this.changesMs) {
      if (timestamp >= change) currentOn = !currentOn;
      else break;
    }
    return currentOn;
  }

  @bind
  send(message: any): void {
    const timestamp = this.scenario.currentTimestamp + this.delayMs;
    if (!this.isOnAtTimestamp(timestamp)) return;
    const event = new MessageEvent(timestamp, this.to, message);
    this.scenario.postEvent(event);
    this.scenario.statistics.recordActiveConnection(timestamp, this.from, this.to);
  }

}
