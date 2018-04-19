import * as _ from "lodash";
import BaseConnection from "./BaseConnection";
import BaseScenario from "./BaseScenario";
import Endpoint from "./Endpoint";
import BaseEvent from "./BaseEvent";
import Logger from "./Logger";
import NodeStartEvent from "./events/NodeStartEvent";
import MessageEvent from "./events/MessageEvent";
import TimeoutEvent from "./events/TimeoutEvent";
import WakeEvent from "./events/WakeEvent";
import CrashEvent from "./events/CrashEvent";
import * as colors from "colors";
import bind from "bind-decorator";


export default abstract class BaseNode implements Endpoint {
  public outgoingConnections: BaseConnection[] = [];
  public nodeNumber: number;
  protected scenario: BaseScenario;
  protected static numNodes = 0;
  protected logger: Logger;
  protected sleeping: boolean = false;

  constructor(scenario: BaseScenario) {
    this.scenario = scenario;
    BaseNode.numNodes++;
    this.nodeNumber = BaseNode.numNodes;
    this.logger = new Logger(`Node ${this.nodeNumber}`, this.scenario);
  }

  onStart(event: NodeStartEvent): void {}

  onMessage(event: MessageEvent): void {}

  onTimeout(event: TimeoutEvent): void {}

  onCrash(event: CrashEvent): void {
    this.log(`Crashed!`);
    this.sleeping = true;
  }

  onWake(event: WakeEvent): void {
    this.log(`Woke up!`);
    this.sleeping = false;
  }

  abstract benchmarkGetClosedBlocks(): any[];

  abstract benchmarkAreClosedBlocksIdentical(block1: any, block2: any): boolean;

  static resetNumNodes(): void {
    BaseNode.numNodes = 0;
  }

  @bind
  handleEvent(event: BaseEvent): void {
    if (event instanceof WakeEvent) this.onWake(event);
    else if (this.sleeping) return;
    else if (event instanceof NodeStartEvent) {
      this.onStart(event);
    } else if (event instanceof MessageEvent) {
      this.onMessage(event);
    } else if (event instanceof TimeoutEvent) {
      this.onTimeout(event);
    } else if (event instanceof CrashEvent) {
      this.onCrash(event);
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
    this.logger.log(`${str}`);
  }

  @bind
  warn(str: string): void {
    this.logger.warn(`${str}`);
  }

  @bind
  error(str: string): void {
    this.logger.error(`${str}`);
  }

}

// hack required to be able to instantiate dynamic instances polymorphically
export class NodeModule extends BaseNode {
  benchmarkGetClosedBlocks(): any[] { return []; }
  benchmarkAreClosedBlocksIdentical(block1: any, block2: any): boolean { return true; }
}
