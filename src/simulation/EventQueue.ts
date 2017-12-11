import PriorityQueue from "ts-priority-queue";
import BaseEvent from "./BaseEvent";
import bind from "bind-decorator";

export default class EventQueue {
  protected internalQueue: PriorityQueue<BaseEvent>;

  constructor() {
    this.internalQueue = new PriorityQueue({ comparator: BaseEvent.comparator });
  }

  @bind
  enqueue(event: BaseEvent): void {
    this.internalQueue.queue(event);
  }

  @bind
  dequeue(): BaseEvent {
    return this.internalQueue.dequeue();
  }

  @bind
  empty(): boolean {
    return this.internalQueue.length === 0;
  }

}
