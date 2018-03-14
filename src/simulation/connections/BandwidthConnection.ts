import BaseConnection from "../BaseConnection";
import OrbsScenario from "../../scenarios/oa-pbft/OrbsScenario";
import BaseNode from "../BaseNode";
import MessageEvent from "../events/MessageEvent";
import BandwidthEndpoint from "../BandwidthEndpoint";
import bind from "bind-decorator";

export default class BandwidthConnection extends BaseConnection {
  public from: BandwidthEndpoint;
  public to: BandwidthEndpoint;
  public connectionDelayMs: number;
  protected minDelayMs: number;
  protected maxDelayMs: number;
  protected scenario: OrbsScenario;



  constructor(scenario: OrbsScenario, from: any, to: any, minDelayMs: number, maxDelayMs: number, to_log: boolean = false) {
    super(scenario, from, to, to_log);
    this.minDelayMs = Math.floor(minDelayMs);
    this.maxDelayMs = Math.ceil(maxDelayMs);
    this.scenario = scenario;
  }

  /**
   * In this model, delay is induced by 3 sources - source and target congestion, and connection delay.
   */
  @bind
  send(message: any): void {
    const delayMs = this.scenario.randomizer.nextIntegerInRange(this.minDelayMs, this.maxDelayMs); // delay due to connection conditions
    const messageSize = message.size_bytes ? message.size_bytes : this.scenario.oaConfig.networkConfiguration.getMessageSize(message); // default for messages without specified size
    const txTime = this.from.addTxEvent(messageSize); // delay due to source congestion
    const arriveTime = txTime + delayMs; // delay due to source congestion + connection
    const rxTime = this.to.addRxEvent(messageSize, arriveTime); // delay due to target congestion
    // console.log(`Sending message ${JSON.stringify(message)} of size ${messageSize} at time ${txTime}, arrival at ${rxTime};`);
    const event = new MessageEvent(rxTime, this.to, message);
    this.scenario.postEvent(event);
    this.scenario.statistics.recordActiveConnection(rxTime, this.from, this.to, message);
  }

}
