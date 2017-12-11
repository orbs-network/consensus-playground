import BaseNode from "./BaseNode";

export default abstract class BaseEvent {
  public timestamp: number;
  public target: BaseNode;

  constructor(timestamp: number, target: BaseNode) {
    this.timestamp = timestamp;
    this.target = target;
  }

  static comparator(a: BaseEvent, b: BaseEvent): number {
    return a.timestamp - b.timestamp;
  }

}
