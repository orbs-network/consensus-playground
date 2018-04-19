import * as _ from "lodash";
import BaseNode from "../../simulation/BaseNode";
import BaseScenario from "../../simulation/BaseScenario";
import NodeStartEvent from "../../simulation/events/NodeStartEvent";
import WakeEvent from "../../simulation/events/WakeEvent";
import CrashEvent from "../../simulation/events/CrashEvent";
import { NetworkPropagationMode } from "../../algorithms/oa-pbft/NetworkInterface";
import { Utils, Message, ConsensusMessageType, CryptoMessageType, SyncerMessageType } from "../../algorithms/oa-pbft/common";
import bind from "bind-decorator";
import Statistics from "../../simulation/Statistics";
import OrbsScenario from "./OrbsScenario";



const MAX_CRASH_DURATION_MS = 5000;
const CRASH_EVERY_X_MS = 10000;
const CRASH_OFFSET_MS = 1000;


export default abstract class OrbsScenarioFaulties extends OrbsScenario {


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
    for (let t = 0; t < this.maxSimulationTimestampMs(); t += CRASH_EVERY_X_MS) {
      const crashNodes = this.randomizer.choice(_.range(this.numNodes), this.numByz);
      for (const n of crashNodes) {
        const crashTime = t + this.randomizer.nextIntegerInRange(0, CRASH_OFFSET_MS);
        this.log(`Node ${this.nodes[n].nodeNumber} crash time : ${crashTime}`);
        const crashEvent = new CrashEvent(crashTime, this.nodes[n]);
        this.postEvent(crashEvent);
        this.statistics.totalCrashes++;
        const wakeTime = Math.min(this.maxSimulationTimestamp, crashTime + this.randomizer.nextIntegerInRange(0, MAX_CRASH_DURATION_MS));
        this.log(`Node ${this.nodes[n].nodeNumber} wake time : ${wakeTime}`);
        const wakeEvent = new WakeEvent(wakeTime, this.nodes[n]);
        this.postEvent(wakeEvent);
      }
    }
    while (!this.eventQueue.empty()) {
      const event = this.eventQueue.dequeue();
      if (event == undefined)
          console.log(` Event UNDEFINED`);
      if (event.timestamp < this.currentTimestamp) {
        this.logger.error(`Event timestamp is lower than current time!   ${JSON.stringify(event)}`);
        continue;
      }

      if (event.timestamp > this.maxSimulationTimestampMs()) break;
      this.currentTimestamp = event.timestamp;
      event.target.handleEvent(event);
      this.statistics.totalEvents++;
      this.statistics.maxTimestampMs = this.currentTimestamp;
    }
    this.onScenarioEnd();
  }


}
