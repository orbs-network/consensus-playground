import BaseConnection from "./BaseConnection";
import BaseScenario from "./BaseScenario";
import BaseEvent from "./BaseEvent";
import NodeStartEvent from "./events/NodeStartEvent";
import MessageEvent from "./events/MessageEvent";
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

  @bind
  handleEvent(event: BaseEvent): void {
    if (event instanceof NodeStartEvent) {
      this.onStart(event);
    } else if (event instanceof MessageEvent) {
      this.onMessage(event);
    }
  }

  @bind
  broadcast(message: any): void {
    for (const connection of this.outgoingConnections) {
      connection.send(message);
    }
  }

}
