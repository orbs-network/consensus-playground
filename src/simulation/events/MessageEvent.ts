import BaseEvent from "../BaseEvent";
import BaseNode from "../BaseNode";

export default class MessageEvent extends BaseEvent {
  public message: any;

  constructor(timestamp: number, target: BaseNode, message: any) {
    super(timestamp, target);
    this.message = message;
  }

}
