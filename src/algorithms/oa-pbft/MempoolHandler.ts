import * as _ from "lodash";
import { Message } from "./common";
import { NetworkInterface } from "./NetworkInterface";
import { Mempool } from "./Mempool";

import bind from "bind-decorator";


export class MempoolHandler {
  protected mempool: Mempool;
  protected netInterface: NetworkInterface;

  @bind
  handleMessage(msg: Message): void {
    return;
  }

}
