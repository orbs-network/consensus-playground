import * as _ from "lodash";
import BaseNode from "./BaseNode";
import BaseScenario from "./BaseScenario";

export default class Statistics {
  public totalEvents: number = 0;
  public maxTimestampMs: number = 0;
  public totalWarnings: number = 0;
  public totalErrors: number = 0;
  public totalSentMessages: number = 0;
  public totalReceivedMessagesPerNode: number[] = [];
  public totalSentBytes: number = 0;
  public totalBroadcasts: number = 0;
  public totalUnicasts: number = 0;

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

  static hasForks(scenario: BaseScenario): boolean {
    for (const node1 of scenario.nodes) {
      for (const node2 of scenario.nodes) {
        if (node1 === node2) continue;
        for (const index in node1.benchmarkGetClosedBlocks()) {
          const blockInNode1 = node1.benchmarkGetClosedBlocks()[index];
          const blockInNode2 = node2.benchmarkGetClosedBlocks()[index];
          if (blockInNode2) {
            if (!node1.benchmarkAreClosedBlocksIdentical(blockInNode1, blockInNode2)) return true;
          }
        }
      }
    }
    return false;
  }

}
