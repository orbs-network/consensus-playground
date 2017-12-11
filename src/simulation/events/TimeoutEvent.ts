import * as _ from "lodash";
import BaseEvent from "../BaseEvent";
import BaseNode from "../BaseNode";

export default class TimeoutEvent extends BaseEvent {
  public message: any;

  constructor(timestamp: number, target: BaseNode, message: any) {
    super(timestamp, target);
    this.message = _.cloneDeep(message);
  }

}
