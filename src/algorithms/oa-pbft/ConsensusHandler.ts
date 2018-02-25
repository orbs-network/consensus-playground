import * as _ from "lodash";
import { Message, ConsensusMessageType } from "./common";
import { ConsensusEngine } from "./ConsensusEngine";
import { NetworkInterface } from "./NetworkInterface";

import bind from "bind-decorator";


export class ConsensusHandler {
  public consensusEngine: ConsensusEngine;
  protected netInterface: NetworkInterface;

  constructor(consensusEngine: ConsensusEngine, netInterface: NetworkInterface) {
    this.consensusEngine = consensusEngine;
    this.netInterface = netInterface;
  }

  @bind
  handleMessage(msg: Message): void {
    switch (msg.conMsgType) {
      case ConsensusMessageType.PrePrepare: {
        this.consensusEngine.handlePrePrepareMessage(msg);
        break;
      }
      case ConsensusMessageType.Prepare: {
        this.consensusEngine.handlePrepareMessage(msg);
        break;
      }
      case ConsensusMessageType.Commit: {
        this.consensusEngine.handleCommitMessage(msg);
        break;
      }
      case ConsensusMessageType.Committed: {
        this.consensusEngine.handleCommittedMessage(msg);
        break;
      }
      case ConsensusMessageType.ViewChange: {
        this.consensusEngine.handleViewChangeMessage(msg);
        break;
      }
      case ConsensusMessageType.NewView: {
        this.consensusEngine.handleNewViewMessage(msg);
        break;
      }

    }
    return;
  }

}
