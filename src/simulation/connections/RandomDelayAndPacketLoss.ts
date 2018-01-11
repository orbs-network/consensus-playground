import BaseConnection from "../BaseConnection";
import BaseScenario from "../BaseScenario";
import BaseNode from "../BaseNode";
import MessageEvent from "../events/MessageEvent";
import bind from "bind-decorator";

export default class RandomDelayAndPacketLoss extends BaseConnection {
  protected minDelayMs: number;
  protected maxDelayMs: number;
  protected packetLossProbability: number;

  constructor(scenario: BaseScenario, from: BaseNode, to: BaseNode, minDelayMs: number, maxDelayMs: number, packetLossProbability: number, to_log: boolean = false) {
    super(scenario, from, to, to_log);
    this.minDelayMs = Math.floor(minDelayMs);
    this.maxDelayMs = Math.ceil(maxDelayMs);
    this.packetLossProbability = packetLossProbability;
  }

  @bind
  send(message: any): void {
    if (this.scenario.randomizer.next() < this.packetLossProbability) return;
    const delayMs = this.scenario.randomizer.nextIntegerInRange(this.minDelayMs, this.maxDelayMs);
    const timestamp = this.scenario.currentTimestamp + delayMs;
    const event = new MessageEvent(timestamp, this.to, message);
    this.scenario.postEvent(event);
    this.scenario.statistics.recordActiveConnection(timestamp, this.from, this.to, message);
    if (this.to_log) {
      this.from.log(`Sending ${JSON.stringify(message)}`);
    }
  }

}
