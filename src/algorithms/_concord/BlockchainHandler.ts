import * as _ from "lodash";
import { Message } from "./common";
import { Blockchain } from "./Blockchain";

import bind from "bind-decorator";


export class BlockchainHandler {
  protected blockchain: Blockchain;

  @bind
  handleMessage(msg: Message): void {
    return;
  }

}
