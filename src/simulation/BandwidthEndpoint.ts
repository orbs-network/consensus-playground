import BaseEvent from "./BaseEvent";
import Endpoint from "./Endpoint";
// TODO A better name for this should be event handler
export default abstract class BandwidthEndpoint extends Endpoint {
  public nodeNumber: number;
  abstract handleEvent(event: BaseEvent): void;
  abstract addTxEvent(msgSize: number): number;
  abstract addRxEvent(msgSize: number, baseArriveTime: number): number;

}
