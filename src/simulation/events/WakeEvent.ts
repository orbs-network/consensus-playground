import * as _ from "lodash";
import BaseEvent from "../BaseEvent";
import BaseNode from "../BaseNode";
import Endpoint from "../Endpoint";

export default class WakeEvent extends BaseEvent {

  constructor(timestamp: number, target: Endpoint) {
    super(timestamp, target);
  }

}
