import * as _ from "lodash";
import BaseConnection from "./BaseConnection";
import BaseScenario from "./BaseScenario";
import BaseEvent from "./BaseEvent";
import NodeStartEvent from "./events/NodeStartEvent";
import MessageEvent from "./events/MessageEvent";
import TimeoutEvent from "./events/TimeoutEvent";
import * as colors from "colors";
import bind from "bind-decorator";

export default abstract class BaseNode {
  public outgoingConnections: BaseConnection[] = [];
  public nodeNumber: number;
  protected scenario: BaseScenario;
  protected static numNodes = 0;

  constructor(scenario: BaseScenario) {
    this.scenario = scenario;
    BaseNode.numNodes++;
    this.nodeNumber = BaseNode.numNodes;
  }

  onStart(event: NodeStartEvent): void {}

  onMessage(event: MessageEvent): void {}

  onTimeout(event: TimeoutEvent): void {}

  abstract benchmarkGetClosedBlocks(): any[];

  abstract benchmarkAreClosedBlocksIdentical(block1: any, block2: any): boolean;

  @bind
  handleEvent(event: BaseEvent): void {
    if (event instanceof NodeStartEvent) {
      this.onStart(event);
    } else if (event instanceof MessageEvent) {
      this.onMessage(event);
    } else if (event instanceof TimeoutEvent) {
      this.onTimeout(event);
    }
  }

  @bind
  broadcast(message: any): void {
    for (const connection of this.outgoingConnections) {
      connection.send(message);
      this.scenario.statistics.totalSentMessages++;
      this.scenario.statistics.totalSentBytes += JSON.stringify(message).length;
      if (!this.scenario.statistics.totalReceivedMessagesPerNode[connection.to.nodeNumber]) this.scenario.statistics.totalReceivedMessagesPerNode[connection.to.nodeNumber] = 0;
      this.scenario.statistics.totalReceivedMessagesPerNode[connection.to.nodeNumber]++;
    }
    this.scenario.statistics.totalBroadcasts++;
  }

  @bind
  unicast(toNodeNumber: number, message: any): void {
    for (const connection of this.outgoingConnections) {
      if (connection.to.nodeNumber === toNodeNumber) {
        connection.send(message);
        this.scenario.statistics.totalSentMessages++;
        this.scenario.statistics.totalSentBytes += JSON.stringify(message).length;
        if (!this.scenario.statistics.totalReceivedMessagesPerNode[connection.to.nodeNumber]) this.scenario.statistics.totalReceivedMessagesPerNode[connection.to.nodeNumber] = 0;
        this.scenario.statistics.totalReceivedMessagesPerNode[connection.to.nodeNumber]++;
      }
    }
    this.scenario.statistics.totalUnicasts++;
  }

  @bind
  setTimeout(timeoutMs: number, message: any): void {
    const timestamp = this.scenario.currentTimestamp + timeoutMs;
    const event = new TimeoutEvent(timestamp, this, message);
    this.scenario.postEvent(event);
  }

  @bind
  log(str: string): void {
    const timestamp = _.padStart(this.scenario.currentTimestamp.toString(), 6, "0");
    console.log(`[${timestamp}] Node ${this.nodeNumber}: ${str}`);
  }

  @bind
  warn(str: string): void {
    const timestamp = _.padStart(this.scenario.currentTimestamp.toString(), 6, "0");
    console.log(colors.yellow.bold(`[${timestamp}] WARNING! Node ${this.nodeNumber}: ${str}`));
    this.scenario.statistics.totalWarnings++;
  }

  @bind
  error(str: string): void {
    const timestamp = _.padStart(this.scenario.currentTimestamp.toString(), 6, "0");
    console.log(colors.red.bold(`[${timestamp}] ERROR! Node ${this.nodeNumber}: ${str}`));
    this.scenario.statistics.totalErrors++;
  }

}

// hack required to be able to instantiate dynamic instances polymorphically
export class NodeModule extends BaseNode {
  benchmarkGetClosedBlocks(): any[] { return []; }
  benchmarkAreClosedBlocksIdentical(block1: any, block2: any): boolean { return true; }
}
