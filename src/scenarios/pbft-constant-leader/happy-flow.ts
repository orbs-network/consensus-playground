import * as _ from "lodash";
import BaseScenario from "../../simulation/BaseScenario";
import BaseNode from "../../simulation/BaseNode";
import { HonestNode } from "../../algorithms/pbft-constant-leader";
import StableConstantDelay from "../../simulation/connections/StableConstantDelay";
import NodeStartEvent from "../../simulation/events/NodeStartEvent";
import Random from "../../simulation/Random";
import bind from "bind-decorator";
import TimeoutEvent from "../../simulation/events/TimeoutEvent";

const NUM_NODES = 4;
const NETWORK_DELAY_MS = 50;
const RAND_MULT = 1; // delay in send message request - manipulate
const MAX_SIMULATION_TIMESTAMP_MS = 2000000; // IMPORTANT make sure it is set high enough for simulation to end
const SIMULATION_PHRASE = "PBFT Hello World!";

export default class Scenario extends BaseScenario {
  protected static nextLetter = -1;
  private rand = new Random();

  @bind
  createNodes(): BaseNode[] {
    return _.times(NUM_NODES, () => {
      return new HonestNode(this);
    });
  }

  @bind
  connectNodes(nodes: BaseNode[]): void {
    for (const fromNode of nodes) {
      for (const toNode of nodes) {
        if (fromNode !== toNode) {
          const connection = new StableConstantDelay(this, fromNode, toNode, NETWORK_DELAY_MS);
          fromNode.outgoingConnections.push(connection);
        }
      }
    }
  }

  @bind
  start() {
    this.currentTimestamp = 0;
    this.nodes = this.createNodes();
    this.connectNodes(this.nodes);
    for (const node of this.nodes) {
      const event = new NodeStartEvent(this.currentTimestamp, node);
      this.postEvent(event);
    }
    _.times(SIMULATION_PHRASE.length, (index) => {
      const node = this.nodes[Math.floor(this.rand.next() * 100) % NUM_NODES];
      const timestamp = this.currentTimestamp + NETWORK_DELAY_MS * Math.floor(this.rand.next() * RAND_MULT); // * index
      const event = new TimeoutEvent(timestamp, node,  SIMULATION_PHRASE[index]);
      this.postEvent(event);
      console.log("timestamp " +  timestamp + " node " + node.nodeNumber + " _ " + SIMULATION_PHRASE[index]
      + " eventQueue " + this.eventQueue.size());
    });
    while (!this.eventQueue.empty()) {
      const event = this.eventQueue.dequeue();
      this.currentTimestamp = event.timestamp;
      if (this.currentTimestamp > this.maxSimulationTimestampMs()) break;
      event.target.handleEvent(event);
    }
  }

  @bind
  maxSimulationTimestampMs(): number {
    return MAX_SIMULATION_TIMESTAMP_MS;
  }

  @bind
  simulatePhrase(): string {
    return SIMULATION_PHRASE[++Scenario.nextLetter];
  }

  @bind
  getSimulationPhrase(): string {
    return SIMULATION_PHRASE;
  }

}
