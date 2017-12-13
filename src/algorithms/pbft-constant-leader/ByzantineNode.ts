import * as _ from "lodash";
import HonestNode from "../pbft-constant-leader/HonestNode";
import BaseEvent from "../../simulation/BaseEvent";
import MessageEvent from "../../simulation/events/MessageEvent";
import TimeoutEvent from "../../simulation/events/TimeoutEvent";
import NodeStartEvent from "../../simulation/events/NodeStartEvent";
import Scenario from "../../scenarios/pbft-constant-leader/happy-flow";
import bind from "bind-decorator";


// IMPORTANT: byzantine changes slot number - when sending prepare

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

export default class ByzantineNode extends HonestNode {  // assume not the primary - change slot number



  @bind
  prePrepareHandle(msg: Message): void {
    // validate message
    if (msg.viewNumber != this.currentView) return;
    if (this.certLog[this.getCertKey(msg.viewNumber, msg.slotNumber)]) return;
    // this.log(`prePrepareHandle ${msg.req.req.txs}`);
    const newCert: Cert = { digest: msg.req.req.txs.toString(), prePrepare: msg.senderId, prepare: [], commit: [], committed: false };
    newCert.prepare.push(this.nodeNumber); // log own prepare  -> moved to prepare phase
    this.certLog[this.getCertKey(msg.viewNumber, msg.slotNumber)] = newCert;
    this.log(`in byz preprepare sn ${msg.slotNumber} txs ${msg.req.req.txs}`);
    // send prepare messages to all
    this.broadcast(<Message>{
      type: MsgType.Prepare,
      senderId: this.nodeNumber,
      viewNumber: this.currentView,
      slotNumber: msg.slotNumber + 1, //  CHANGED SLOT NUMBER
      req: msg.req // includes client block request
     });
     // this.log
     // this.timeout//
     // this.setTimeout(BLOCK_TIMEOUT_MS, <Message>{ type: MsgType.ChangeView});
  }

  // @bind
  // prepareHandle(msg: Message): void {
  //   // validate message - TODO: compare digests
  //   // if prepared(digest, v, n) && !cert.sentCommit {
  //   if ((msg.viewNumber != this.currentView) || (msg.senderId == this.primary())) return;
  //   const cert = this.certLog[this.getCertKey(msg.viewNumber, msg.slotNumber)];
  //   if (cert && cert.digest != msg.req.req.txs.toString())
  //     this.log(`Discovered Byzantine : node ${msg.senderId} used slot number ${msg.slotNumber} for  letter ${msg.req.req.txs} cert ${cert.digest}`);
  //   if (!cert || !cert.prePrepare || cert.digest != msg.req.req.txs.toString() || cert.commit.length) return;  // assume nodeNumber (id) indexed from 1..
  //   // log
  //   cert.prepare.push(msg.senderId);
  //   cert.prepare = _.uniq(cert.prepare);
  //   if (cert.prepare.length >= this.quorumSize() - 1) { // 2f + preprepare from primary
  //     cert.commit.push(this.nodeNumber); // log own commit -> moved to commit phase
  //     // send prepare messages to all
  //     this.broadcast(<Message>{
  //       type: MsgType.Commit,
  //       senderId: this.nodeNumber,
  //       viewNumber: this.currentView,
  //       slotNumber: msg.slotNumber,
  //       req: msg.req // includes client block request
  //    });
  //    // this.log
  //   }
  //   this.certLog[this.getCertKey(msg.viewNumber, msg.slotNumber)] = cert;
  // }



  // @bind
  // commitHandle(msg: Message): void {
  //   // validate message
  //   if (msg.viewNumber != this.currentView) return;
  //   const cert = this.certLog[this.getCertKey(msg.viewNumber, msg.slotNumber)];
  //   if (!cert || !cert.prePrepare || cert.committed) return;  // assume nodeNumber (id) indexed from 1..
  //   // this.log(`commitHandle`);
  //   // log
  //   cert.commit.push(msg.senderId);
  //   cert.commit = _.uniq(cert.commit);
  //   if (cert.commit.length >= this.quorumSize()) { // 2f + 1 commit messages
  //     cert.committed = true;
  //     this.ledger[msg.slotNumber] = msg.req.req;
  //     // try exec and send response to client -> depends on all previous slots
  //     this.execute();
  //     // this.log
  //   }
  //   this.certLog[this.getCertKey(msg.viewNumber, msg.slotNumber)] = cert;
  // }

  // @bind
  // execute(): void { // depends on previous slots executed
  //   let lei: number;
  //   for (lei = this.lastExecSN + 1; lei < this.ledger.length; lei++) {
  //     if (this.ledger[lei]) {
  //       this.phrase += this.ledger[lei].txs;
  //       // optional >
  //       //   this.broadcast(<Message>{
  //       //     type: MsgType.Response,
  //       //     senderId: this.nodeNumber,
  //       //     req: this.ledger[lei].txs //includes client block request
  //       //  });
  //     }
  //     else
  //       break;
  //   }
  //   this.log(`current phrase: ${this.phrase}`);
  //   this.lastExecSN = lei - 1;
  // }

}