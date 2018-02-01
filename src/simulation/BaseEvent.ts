import BaseNode from "./BaseNode";
import Endpoint from "./Endpoint";

export default abstract class BaseEvent {
  public timestamp: number;
  public target: Endpoint;
  public uid: number;
  protected static numEvents = 0;

  constructor(timestamp: number, target: Endpoint) {
    this.timestamp = timestamp;
    this.target = target;
    BaseEvent.numEvents++;
    this.uid = BaseEvent.numEvents;
  }

  static comparator(a: BaseEvent, b: BaseEvent): number {
    return a.timestamp - b.timestamp; // TODO maybe change to uid for deteministic effect for events with same timestamp?
  }

  isSameEvent(otherEvent: BaseEvent): boolean {
    return (this.uid == otherEvent.uid);
  }

}
