import * as _ from "lodash";
import { ConsensusEngine } from "./ConsensusEngine";

import { Utils, Message } from "./common";
import Logger from "../../simulation/Logger";
import BaseEvent from "../../simulation/BaseEvent";
import BaseConnection from "../../simulation/BaseConnection";
import BaseScenario from "../../simulation/BaseScenario";
import TimeoutEvent from "../../simulation/events/TimeoutEvent";
import Endpoint from "../../simulation/Endpoint";
import { Syncer } from "./Syncer";

import bind from "bind-decorator";

export class Timer implements Endpoint {

  protected consensusEngine: ConsensusEngine;
  public nodeNumber: number;
  protected scenario: BaseScenario;
  protected utils: Utils;
  protected syncer: Syncer;

  protected proposalTimeoutEvent: TimeoutEvent = undefined;

  @bind
  init(consensusEngine: ConsensusEngine, nodeNumber: number, scenario: BaseScenario, utils: Utils, syncer: Syncer) {
    this.consensusEngine = consensusEngine;
    this.scenario = scenario;
    this.nodeNumber = nodeNumber;
    this.utils = utils;
    this.syncer = syncer;
  }

  @bind
  stopTimer(): void {
    this.proposalTimeoutEvent = undefined;
  }

  @bind
  setProposalTimer(duration: number): void {
    if (this.proposalTimeoutEvent) {
      this.utils.logger.debug(`Existing timer already set to expire at ${this.proposalTimeoutEvent.timestamp}, resetting it!`);
    }
    const proposalTimeoutMsg = { sender: this.nodeNumber, type: "ProposalTimeoutExpired" };
    const timestamp = this.scenario.currentTimestamp + duration;
    this.utils.logger.log(`Setting proposal timer to expire at ${timestamp}...`);
    const event = new TimeoutEvent(timestamp, this, proposalTimeoutMsg);
    this.proposalTimeoutEvent = event;
    this.scenario.postEvent(event);
  }

  @bind
  setWakeupTimer(duration: number): void {
    const proposalTimeoutMsg = { sender: this.nodeNumber, type: "TimeToWakeup" };
    const timestamp = this.scenario.currentTimestamp + duration;
    this.utils.logger.log(`Will wake up at ${timestamp}...`);
    const event = new TimeoutEvent(timestamp, this, proposalTimeoutMsg);
    this.proposalTimeoutEvent = event;
    this.scenario.postEvent(event);
  }

  @bind
  setSleepTimer(duration: number): void {
    const proposalTimeoutMsg = { sender: this.nodeNumber, type: "TimeToSleep" };
    const timestamp = this.scenario.currentTimestamp + duration;
    this.utils.logger.log(`Will sleep at ${timestamp}...`);
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
        if (this.utils.sleeping) return; // TODO better that this would be in one central spot in the node
        // if this is an old timer expiring we ignore it. Ideally, we would have removed the old event
        // from the scenario event queue but the PriorityQueue api doesn't support this.
        if (this.proposalTimeoutEvent && this.proposalTimeoutEvent.isSameEvent(event)) this.consensusEngine.handleProposalExpiredTimeout();
        break;
      }

      case "TimeToWakeup": {
        this.utils.logger.log(`Waking up...`);
        this.utils.sleeping = false;
        this.syncer.requestSync();
        // TODO maybe run some node reset code on syncer?
        break;
      }

      case "TimeToSleep": {
        if (this.utils.sleeping) return; // TODO better that this would be in one central spot in the node
        this.utils.logger.log(`Going to sleep...`);
        this.utils.sleeping = true;
        this.stopTimer();
        break;
      }
    }
  }





}
