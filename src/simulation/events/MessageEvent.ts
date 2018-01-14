import * as _ from "lodash";
import BaseEvent from "../BaseEvent";
import BaseNode from "../BaseNode";
import Endpoint from "../Endpoint";

export default class MessageEvent extends BaseEvent {
  public message: any;

  constructor(timestamp: number, target: Endpoint, message: any) {
    super(timestamp, target);
    this.message = _.cloneDeep(message);
  }

}
