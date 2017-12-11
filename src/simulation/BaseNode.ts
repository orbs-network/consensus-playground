import * as _ from "lodash";
import BaseConnection from "./BaseConnection";
import BaseScenario from "./BaseScenario";
import BaseEvent from "./BaseEvent";
import NodeStartEvent from "./events/NodeStartEvent";
import MessageEvent from "./events/MessageEvent";
import TimeoutEvent from "./events/TimeoutEvent";
import bind from "bind-decorator";

export default abstract class BaseNode {
  public outgoingConnections: BaseConnection[] = [];
  public nodeNumber: number;
  protected scenario: BaseScenario;
  protected static numNodes = 0;

  constructor(scenario: BaseScenario) {
    this.scenario = scenario;
    BaseNode.numNodes++;
    this.nodeNumber = BaseNode.numNodes;
  }

  onStart(event: NodeStartEvent): void {}

  onMessage(event: MessageEvent): void {}

  onTimeout(event: TimeoutEvent): void {}

  @bind
  handleEvent(event: BaseEvent): void {
    if (event instanceof NodeStartEvent) {
      this.onStart(event);
    } else if (event instanceof MessageEvent) {
      this.onMessage(event);
    } else if (event instanceof TimeoutEvent) {
      this.onTimeout(event);
    }
  }

  @bind
  broadcast(message: any): void {
    for (const connection of this.outgoingConnections) {
      connection.send(message);
    }
  }

  @bind
  setTimeout(timeoutMs: number, message: any): void {
    const timestamp = this.scenario.currentTimestamp + timeoutMs;
    const event = new TimeoutEvent(timestamp, this, message);
    this.scenario.postEvent(event);
  }

  @bind
  log(str: string): void {
    const timestamp = _.padStart(this.scenario.currentTimestamp.toString(), 6, "0");
    console.log(`[${timestamp}] Node ${this.nodeNumber}: ${str}`);
  }

}
