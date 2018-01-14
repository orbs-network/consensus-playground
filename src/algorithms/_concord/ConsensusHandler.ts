import * as _ from "lodash";
import { Message } from "./common";
import { ConsensusEngine } from "./ConsensusEngine";
import { NetworkInterface } from "./NetworkInterface";

import bind from "bind-decorator";


export class ConsensusHandler {
  protected consensusEngine: ConsensusEngine;
  protected netInterface: NetworkInterface;

  constructor(consensusEngine: ConsensusEngine, netInterface: NetworkInterface) {
    this.consensusEngine = consensusEngine;
    this.netInterface = netInterface;
  }

  @bind
  handleMessage(msg: Message): void {
    return;
  }


}
