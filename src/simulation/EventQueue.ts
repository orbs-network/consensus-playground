import PriorityQueue from "ts-priority-queue";
import BaseEvent from "./BaseEvent";
import bind from "bind-decorator";

export default class EventQueue {
  private _length: number = 0;
  public get length() { return this._length; }

  protected internalQueue: Object;
  protected helperQueue: PriorityQueue<number>;

  constructor() {
      this.internalQueue = {};
      this.helperQueue = new PriorityQueue({
         comparator: function(a: number, b: number) {return a - b; } });
  }

  @bind
  enqueue(event: BaseEvent): void {
    if (!this.internalQueue[event.timestamp]) {
        this.internalQueue[event.timestamp] = new Array();
        this.helperQueue.queue(event.timestamp);
    }
    this.internalQueue[event.timestamp].push(event);
    this._length++;
  }

  @bind
  dequeue(): BaseEvent {
    if (!this._length) throw new Error("Empty queue");
    const header = this.helperQueue.peek();
    const res = this.internalQueue[header].shift();
    if (this.internalQueue[header].length <= 0) {
      delete this.internalQueue[header];
      this.helperQueue.dequeue();
    }
    this._length--;
    return res;
  }

  @bind
  empty(): boolean {
    return this._length === 0;
  }

  @bind
  size(): number {
    return this._length;
  }

}
