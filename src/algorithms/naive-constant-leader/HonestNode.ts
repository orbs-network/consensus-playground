import BaseNode from "../../simulation/BaseNode";
import BaseEvent from "../../simulation/BaseEvent";
import MessageEvent from "../../simulation/events/MessageEvent";
import NodeStartEvent from "../../simulation/events/NodeStartEvent";
import bind from "bind-decorator";

export default class HonestNode extends BaseNode {

  @bind
  onStart(event: NodeStartEvent): void {
  }

  @bind
  onMessage(event: MessageEvent): void {
  }

}
