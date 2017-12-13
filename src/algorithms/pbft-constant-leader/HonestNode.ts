import * as _ from "lodash";
import BaseNode from "../../simulation/BaseNode";
import BaseEvent from "../../simulation/BaseEvent";
import MessageEvent from "../../simulation/events/MessageEvent";
import TimeoutEvent from "../../simulation/events/TimeoutEvent";
import NodeStartEvent from "../../simulation/events/NodeStartEvent";
import Scenario from "../../scenarios/pbft-constant-leader/happy-flow";
import bind from "bind-decorator";


const BLOCK_TIMEOUT_MS = 1000;

interface Block {
  txs: string;
  timestamp: number;  // only for requests? exactly once semantic
}

interface Cert {
  digest: string; // message
  prePrepare: number;
  prepare: any[];
  commit: any[];
  committed: boolean;
}

enum MsgType {
  Request = 1,
  PrePrepare = 2,
  Prepare = 3,
  Commit = 4,
  CheckPoint = 5,
  ChangeView = 6,
  NewView = 7,
  Response = 10,
  TimeOut = 20
}

interface Message { // TODO: split different types  /timestamp fro request
  type: MsgType;
  senderId: number;  // signed cannot be forged -> TODO: should implement in msgevent (from)?
  viewNumber?: number;
  slotNumber?: number;
  req?: any;
}

export default class HonestNode extends BaseNode {
  protected currentView = 1;
  protected certLog: Cert[] = [];
  protected ledger: Block[] = [];
  protected ledgerGhost: Block[] = []; // for primary to order
  protected lastExecSN = -1;
  protected activeView = true;
  protected phrase = "";
  protected nextBlockNumber = -1;


  @bind
  onMessage(event: MessageEvent): void {
    const msg = <Message>event.message;
    switch (msg.type) {
      case MsgType.Request: {
        this.requestHandle(msg);
        break;
      }
      case MsgType.PrePrepare: {
        this.prePrepareHandle(msg);
        break;
      }
      case MsgType.Prepare: {
        this.prepareHandle(msg);
        break;
      }
      case MsgType.Commit: {
        this.commitHandle(msg);
        break;
      }
      case MsgType.CheckPoint: {
        this.checkPointHandle(msg);
        break;
      }
      case MsgType.ChangeView: {
        this.changeViewHandle(msg);
        break;
      }
      case MsgType.NewView: {
        this.newViewHandle(msg);
        break;
      }
      case MsgType.Response: { // optional ..
        this.responseHandle(msg);
        break;
      }
      case MsgType.TimeOut: {
        console.log("TimeOut");
        // this.primaryStartNextBlock();
        break;
      }
    }
  }


  checkPointHandle(msg: Message): void {}
  changeViewHandle(msg: Message): void {
    // log Change View
  }
  newViewHandle(msg: Message): void {}
  // optional
  responseHandle(msg: Message): void {}

  validate(msg: Message): boolean { // basic validation
    return true;
  }

  @bind
  protected getSlotNumber(msg: Message): number { // ordering logic  -  assume ..
    // return this.ledgerGhost.length;
    const phrase = (<Scenario>this.scenario).getSimulationPhrase();
    let slotNumber = -1;
    while ((slotNumber = phrase.indexOf(msg.req.txs, slotNumber + 1)) >= 0 && this.ledgerGhost[slotNumber]);
    console.log(msg.req.txs + " primary order slot# " + slotNumber);
    return slotNumber;
  }

  @bind
  primary(): number {
    return this.currentView % BaseNode.numNodes; // constant leader (first node)
  }

  @bind
  isPrimary(): boolean {
    return this.nodeNumber == this.primary(); // constant leader (first node)
  }

  @bind
  quorumSize(): number {
    return Math.floor(BaseNode.numNodes / 3) * 2 + 1;
  }

  @bind
  getCertKey(view: number, slot: number): string {
    return String(view) + "-" + String(slot);
  }


  @bind
  sendRequest(txs: string): void {
    const block: Block = {txs: txs, timestamp: this.scenario.currentTimestamp};
    this.log(`starting block ${txs}`);
    const msg: Message = { // TODO: unicast to primary
      type: MsgType.Request,
      senderId: this.nodeNumber,
      req: block // client block request
     };
    if (this.isPrimary())
      this.requestHandle(msg);
    else
     this.broadcast(msg);
    // this.timeout//
  }

  @bind
  requestHandle(msg: Message): void {
    // validate message
    if (!this.isPrimary()) return;  // TODO: cast msg to primary
    // PrePrepare logic - assume valid slotnumber
    // this.log(`requestHandle ${msg.req.txs}`);
    const slotNumber = this.getSlotNumber(msg);
    this.ledgerGhost[slotNumber] = msg.req;
    const newCert: Cert = { digest: msg.req.txs.toString(), prePrepare: this.nodeNumber, prepare: [], commit: [], committed: false };
    this.certLog[this.getCertKey(this.currentView, slotNumber)] = newCert;
    this.broadcast(<Message>{
      type: MsgType.PrePrepare,
      senderId: this.nodeNumber,
      viewNumber: this.currentView,
      slotNumber: slotNumber,
      req: msg // includes client block request
     });
    // this.timeout//
  }


  @bind
  prePrepareHandle(msg: Message): void {
    // validate message
    if (msg.viewNumber != this.currentView) return;
    if (this.certLog[this.getCertKey(msg.viewNumber, msg.slotNumber)]) return;
    // this.log(`prePrepareHandle ${msg.req.req.txs}`);
    const newCert: Cert = { digest: msg.req.req.txs.toString(), prePrepare: msg.senderId, prepare: [], commit: [], committed: false };
    newCert.prepare.push(this.nodeNumber); // log own prepare  -> moved to prepare phase
    this.certLog[this.getCertKey(msg.viewNumber, msg.slotNumber)] = newCert;
    // send prepare messages to all
    this.broadcast(<Message>{
      type: MsgType.Prepare,
      senderId: this.nodeNumber,
      viewNumber: this.currentView,
      slotNumber: msg.slotNumber,
      req: msg.req // includes client block request
     });
     // this.log
     // this.timeout//
     // this.setTimeout(BLOCK_TIMEOUT_MS, <Message>{ type: MsgType.ChangeView});
  }

  @bind
  prepareHandle(msg: Message): void {
    // validate message - TODO: compare digests
    // if prepared(digest, v, n) && !cert.sentCommit {
    if ((msg.viewNumber != this.currentView) || (msg.senderId == this.primary())) return;
    const cert = this.certLog[this.getCertKey(msg.viewNumber, msg.slotNumber)];
    if (cert && cert.digest != msg.req.req.txs.toString())
      this.log(`Discovered Byzantine : node ${msg.senderId} used slot number ${msg.slotNumber} for  letter ${msg.req.req.txs} cert ${cert.digest}`);
    if (!cert || !cert.prePrepare || cert.digest != msg.req.req.txs.toString() || cert.commit.length) return;  // assume nodeNumber (id) indexed from 1..
    // log
    cert.prepare.push(msg.senderId);
    cert.prepare = _.uniq(cert.prepare);
    if (cert.prepare.length >= this.quorumSize() - 1) { // 2f + preprepare from primary
      cert.commit.push(this.nodeNumber); // log own commit -> moved to commit phase
      // send prepare messages to all
      this.broadcast(<Message>{
        type: MsgType.Commit,
        senderId: this.nodeNumber,
        viewNumber: this.currentView,
        slotNumber: msg.slotNumber,
        req: msg.req // includes client block request
     });
     // this.log
    }
    this.certLog[this.getCertKey(msg.viewNumber, msg.slotNumber)] = cert;
  }


  @bind
  commitHandle(msg: Message): void {
    // validate message
    if (msg.viewNumber != this.currentView) return;
    const cert = this.certLog[this.getCertKey(msg.viewNumber, msg.slotNumber)];
    if (!cert || !cert.prePrepare || cert.committed) return;  // assume nodeNumber (id) indexed from 1..
    // this.log(`commitHandle`);
    // log
    cert.commit.push(msg.senderId);
    cert.commit = _.uniq(cert.commit);
    if (cert.commit.length >= this.quorumSize()) { // 2f + 1 commit messages
      cert.committed = true;
      this.ledger[msg.slotNumber] = msg.req.req;
      // try exec and send response to client -> depends on all previous slots
      this.execute();
      // this.log
    }
    this.certLog[this.getCertKey(msg.viewNumber, msg.slotNumber)] = cert;
  }

  @bind
  execute(): void { // depends on previous slots executed
    let lei: number;
    for (lei = this.lastExecSN + 1; lei < this.ledger.length; lei++) {
      if (this.ledger[lei]) {
        this.phrase += this.ledger[lei].txs;
        // optional >
        //   this.broadcast(<Message>{
        //     type: MsgType.Response,
        //     senderId: this.nodeNumber,
        //     req: this.ledger[lei].txs //includes client block request
        //  });
      }
      else
        break;
    }
    this.log(`current phrase: ${this.phrase}`);
    this.lastExecSN = lei - 1;
  }


  @bind
  onStart(event: NodeStartEvent): void {
    this.log(`onStart current view: ${this.currentView % BaseNode.numNodes}`);
    // this.startNextBlock();
  }

  @bind
  startNextBlock(msg: string): void {
    // this.log(`startNextBlock `);
    const txs = msg; // (<Scenario>this.scenario).simulatePhrase();
    if (txs != undefined) {
      // console.log(txs);
      // this.setTimeout(BLOCK_TIMEOUT_MS, <Message>{ type: MsgType.TimeOut, senderId: this.nodeNumber });
      this.sendRequest(txs);
    }
  }


  @bind
  onTimeout(event: TimeoutEvent): void {
    const msg = event.message;
    this.startNextBlock(msg);
  }


}