import BaseNode from "./BaseNode";
import Endpoint from "./Endpoint";

export default abstract class BaseEvent {
  public timestamp: number;
  public target: Endpoint;

  constructor(timestamp: number, target: Endpoint) {
    this.timestamp = timestamp;
    this.target = target;
  }

  static comparator(a: BaseEvent, b: BaseEvent): number {
    return a.timestamp - b.timestamp;
  }

}
