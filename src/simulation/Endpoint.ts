import BaseEvent from "./BaseEvent";

// TODO A better name for this should be event handler
export default abstract class Endpoint {
  public nodeNumber: number;
  abstract handleEvent(event: BaseEvent): void;

}
