import * as _ from "lodash";
import BaseNode from "./BaseNode";
import BaseScenario from "./BaseScenario";
import Endpoint from "./Endpoint";

interface RecordedMessagesInInterval {
  activeConnections: {[from: number]: {[to: number]: boolean}};
}

export default class Statistics {
  public totalEvents: number = 0;
  public maxTimestampMs: number = 0;
  public totalWarnings: number = 0;
  public totalErrors: number = 0;
  public totalSentMessages: number = 0;
  public totalReceivedMessagesPerNode: number[] = [];
  public totalSentBytes: number = 0;
  public totalBroadcasts: number = 0;
  public totalMulticasts: number = 0;
  public totalUnicasts: number = 0;
  public totalCrashes: number = 0;
  public shouldRecordMessagesByInterval = -1; // interval > 0 in ms if you want to record
  public recordedMessagesByInterval: RecordedMessagesInInterval[] = [];
  public recordedMessageValues: {[value: string]: boolean} = {};

  // if interval 50, ts=0:index=0, ts=49:index=0, ts=50:index=1
  getIntervalIndexForTimestamp(timestamp: number): number {
    if (this.shouldRecordMessagesByInterval === -1) return -1;
    return Math.floor(timestamp / this.shouldRecordMessagesByInterval);
  }

  recordActiveConnection(timestamp: number, from: Endpoint, to: Endpoint, message: any): void {
    if (this.shouldRecordMessagesByInterval === -1) return;
    const intervalIndex = this.getIntervalIndexForTimestamp(timestamp);
    if (!this.recordedMessagesByInterval[intervalIndex]) {
      this.recordedMessagesByInterval[intervalIndex] = {
        activeConnections: {}
      };
    }
    const value = _.get(message, "type", "Unknown");
    _.set(this.recordedMessagesByInterval[intervalIndex].activeConnections, [from.nodeNumber, to.nodeNumber], value);
    _.set(this.recordedMessageValues, value, true);
  }

  static numClosedBlocksPerNode(scenario: BaseScenario): number[] {
    const numClosedBlocksPerNode = [];
    for (const node of scenario.nodes) {
      numClosedBlocksPerNode.push(Object.keys(node.benchmarkGetClosedBlocks()).length);
    }
    return numClosedBlocksPerNode;
  }

  static minClosedBlocks(scenario: BaseScenario): number {
    return _.min(Statistics.numClosedBlocksPerNode(scenario));
  }

  static maxClosedBlocks(scenario: BaseScenario): number {
    return _.max(Statistics.numClosedBlocksPerNode(scenario));
  }

  // static hasForks(scenario: BaseScenario): boolean {
  //   for (const node1 of scenario.nodes) {
  //     for (const node2 of scenario.nodes) {
  //       if (node1 === node2) continue;
  //       for (const index in node1.benchmarkGetClosedBlocks()) {
  //         const blockInNode1 = node1.benchmarkGetClosedBlocks()[index];
  //         const blockInNode2 = node2.benchmarkGetClosedBlocks()[index];
  //         if (blockInNode2) {
  //           if (!node1.benchmarkAreClosedBlocksIdentical(blockInNode1, blockInNode2)) {
  //             console.log("^^^^^^^^^^^^^^^Fork: " + node1.nodeNumber + "-" + node2.nodeNumber + "-" + index);
  //             return true;
  //           }
  //         }
  //       }
  //     }
  //   }
  //   return false;
  // }

  static hasForks(scenario: BaseScenario): boolean {
    for (const node1 of scenario.nodes) {
      for (const node2 of scenario.nodes) {
        if (node1 === node2) continue;
        const blocksInNode2 = node2.benchmarkGetClosedBlocks();
        for (const index in node1.benchmarkGetClosedBlocks()) {
          const blockInNode1 = node1.benchmarkGetClosedBlocks()[index];
          for (const index2 in blocksInNode2) {
            if (blockInNode1.term == blocksInNode2[index2].term) {
              if (!node1.benchmarkAreClosedBlocksIdentical(blockInNode1, blocksInNode2[index2])) {
                console.log("^^^^^^^^^^^^^^^Fork: " + node1.nodeNumber + "-" + node2.nodeNumber + "-" + index);
                return true;
              }
            }
          }
        }
      }
    }
    return false;
  }
}
