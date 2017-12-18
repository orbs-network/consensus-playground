import Random from "../simulation/Random";
import EventQueue from "../simulation/EventQueue";
import BaseEvent from "../simulation/BaseEvent";
import BaseNode from "../simulation/BaseNode";
import Statistics from "../simulation/Statistics";
import NodeStartEvent from "../simulation/events/NodeStartEvent";
import bind from "bind-decorator";

export default abstract class BaseScenario {
  public randomizer: Random;
  public currentTimestamp: number;
  public numNodes: number;
  public statistics: Statistics;
  protected eventQueue: EventQueue;
  protected nodes: BaseNode[];

  constructor(seed: string) {
    this.randomizer = new Random(seed);
    this.eventQueue = new EventQueue();
    this.statistics = new Statistics();
  }

  abstract createNodes(): BaseNode[];

  abstract connectNodes(nodes: BaseNode[]): void;

  abstract maxSimulationTimestampMs(): number;

  @bind
  start() {
    this.currentTimestamp = 0;
    this.nodes = this.createNodes();
    this.numNodes = this.nodes.length;
    this.connectNodes(this.nodes);
    for (const node of this.nodes) {
      const event = new NodeStartEvent(this.currentTimestamp, node);
      this.postEvent(event);
    }
    while (!this.eventQueue.empty()) {
      const event = this.eventQueue.dequeue();
      this.currentTimestamp = event.timestamp;
      if (this.currentTimestamp > this.maxSimulationTimestampMs()) break;
      event.target.handleEvent(event);
      this.statistics.totalEvents++;
    }
    this.statistics.maxTimestampMs = this.currentTimestamp;
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
