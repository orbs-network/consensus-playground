import BaseEvent from "./BaseEvent";

export default abstract class Endpoint {
  public nodeNumber: number;
  abstract handleEvent(event: BaseEvent): void;

}
