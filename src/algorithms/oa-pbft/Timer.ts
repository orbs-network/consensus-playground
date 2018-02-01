import * as _ from "lodash";
import { ConsensusEngine } from "./ConsensusEngine";

import { Utils, Message } from "./common";
import Logger from "../../simulation/Logger";
import BaseEvent from "../../simulation/BaseEvent";
import BaseConnection from "../../simulation/BaseConnection";
import BaseScenario from "../../simulation/BaseScenario";
import TimeoutEvent from "../../simulation/events/TimeoutEvent";
import Endpoint from "../../simulation/Endpoint";

import bind from "bind-decorator";

export class Timer implements Endpoint {

  protected consensusEngine: ConsensusEngine;
  public nodeNumber: number;
  protected scenario: BaseScenario;
  protected logger: Logger;

  protected proposalTimeoutEvent: TimeoutEvent = undefined;

  @bind
  init(consensusEngine: ConsensusEngine, nodeNumber: number, scenario: BaseScenario, logger: Logger) {
    this.consensusEngine = consensusEngine;
    this.scenario = scenario;
    this.nodeNumber = nodeNumber;
    this.logger = logger;
  }

  @bind
  setProposalTimer(duration: number): void {
    if (this.proposalTimeoutEvent) {
      this.logger.debug(`Existing timer already set to expire at ${this.proposalTimeoutEvent.timestamp}, resetting it!`);
    }
    const proposalTimeoutMsg = { sender: this.nodeNumber, type: "ProposalTimeoutExpired" };
    const timestamp = this.scenario.currentTimestamp + duration;
    this.logger.log(`Setting proposal timer to expire at ${timestamp}...`);
    const event = new TimeoutEvent(timestamp, this, proposalTimeoutMsg);
    this.proposalTimeoutEvent = event;
    this.scenario.postEvent(event);
  }

  // TODO probably don't need this
  @bind
  setTimeout(timeoutMs: number, message: any): void {
    const timestamp = this.scenario.currentTimestamp + timeoutMs;
    const event = new TimeoutEvent(timestamp, this, message);
    this.scenario.postEvent(event);
  }

  @bind
  handleEvent(event: BaseEvent): void {
    if (event instanceof TimeoutEvent) {
      this.handleTimeout(event);
    }
  }

  @bind
  handleTimeout(event: TimeoutEvent): void {
    const msg = <Message>event.message;
    switch (msg.type) {
      case "ProposalTimeoutExpired": {
        // if this is an old timer expiring we ignore it. Ideally, we would have removed the old event
        // from the scenario event queue but the PriorityQueue api doesn't support this.
        if (this.proposalTimeoutEvent.isSameEvent(event)) this.consensusEngine.handleProposalExpiredTimeout();
        break;
      }
    }
  }


}
