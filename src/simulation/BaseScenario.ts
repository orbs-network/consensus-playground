import Random from "./Random";
import EventQueue from "./EventQueue";
import BaseEvent from "./BaseEvent";
import BaseNode from "./BaseNode";
import Statistics from "./Statistics";
import NodeStartEvent from "./events/NodeStartEvent";
import bind from "bind-decorator";

export default abstract class BaseScenario {
  public randomizer: Random;
  public currentTimestamp: number;
  public numNodes: number;
  public statistics: Statistics;
  public nodes: BaseNode[];
  protected eventQueue: EventQueue;

  constructor(seed: string) {
    this.randomizer = new Random(seed);
    this.eventQueue = new EventQueue();
    this.statistics = new Statistics();
    BaseNode.resetNumNodes();
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
      this.statistics.maxTimestampMs = this.currentTimestamp;
    }
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
