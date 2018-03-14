import Random from "./Random";
import EventQueue from "./EventQueue";
import BaseEvent from "./BaseEvent";
import BaseNode from "./BaseNode";
import Statistics from "./Statistics";
import Logger from "./Logger";
import NodeStartEvent from "./events/NodeStartEvent";
import bind from "bind-decorator";

export default abstract class BaseScenario {
  public randomizer: Random;
  public currentTimestamp: number;
  public numNodes: number;
  public statistics: Statistics;
  public logger: Logger;
  public nodes: BaseNode[];
  public timestepsToMs: number = 1.0;
  protected eventQueue: EventQueue;

  constructor(seed: string) {
    this.randomizer = new Random(seed);
    this.eventQueue = new EventQueue();
    this.statistics = new Statistics();
    this.logger = new Logger("BaseScenario", this);
    BaseNode.resetNumNodes();
  }

  abstract createNodes(): BaseNode[];

  abstract connectNodes(nodes: BaseNode[]): void;

  abstract maxSimulationTimestampMs(): number;

  onScenarioEnd(): void {}

  @bind
  msToTs(ms: number): number {
    return Math.ceil(this.timestepsToMs * ms);
  }

  @bind
  tsToMs(ts: number): number {
    return Math.ceil((1 / this.timestepsToMs) * ts);
  }

  @bind
  start() {
    this.currentTimestamp = 0;
    this.nodes = this.createNodes();
    this.numNodes = this.nodes.length;
    this.connectNodes(this.nodes);
    const debugThreshold = this.logger.getDebugThreshold();
    for (const node of this.nodes) {
      const event = new NodeStartEvent(this.currentTimestamp, node);
      this.postEvent(event);
    }
    while (!this.eventQueue.empty()) {
      const event = this.eventQueue.dequeue();
      if (event == undefined)
          console.log(` Event UNDEFINED`);
      if (event.timestamp < this.currentTimestamp) {
        this.logger.error(`Event timestamp is lower than current time!   ${JSON.stringify(event)}`);
        continue;
      }
      if (event.timestamp > this.currentTimestamp) {
        this.logger.log(`Current Time: ${this.currentTimestamp}`, debugThreshold);
      }
      if (event.timestamp > this.maxSimulationTimestampMs()) break;
      this.currentTimestamp = event.timestamp;
      event.target.handleEvent(event);
      this.statistics.totalEvents++;
      this.statistics.maxTimestampMs = this.currentTimestamp;
    }
    this.onScenarioEnd();
  }

  @bind
  postEvent(event: BaseEvent) {
    this.eventQueue.enqueue(event);
  }

}

// hack required to be able to instantiate dynamic instances polymorphically
export class ScenarioModule extends BaseScenario {
  createNodes(): BaseNode[] { return []; }
  connectNodes(nodes: BaseNode[]) {}
  maxSimulationTimestampMs() { return 0; }
}
