import * as _ from "lodash";
import { Message } from "./common";
import { Blockchain } from "./Blockchain";

import bind from "bind-decorator";


export class BlockchainHandler {
  public blockchain: Blockchain;

  constructor(blockchain: Blockchain) {
    this.blockchain = blockchain;
  }
  @bind
  handleMessage(msg: Message): void {
    return;
  }

}
