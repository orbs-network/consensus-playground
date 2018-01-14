import * as _ from "lodash";
import { Utils, Block, Proposal, Message } from "./common";
import { Blockchain } from "./Blockchain";
import { Mempool } from "./Mempool";
import { Decryptor } from "./Decryptor";
import { ConsensusEngine } from "./ConsensusEngine";
import { NetworkInterface } from "./NetworkInterface";
import { MempoolHandler } from "./MempoolHandler";
import { BlockchainHandler } from "./BlockchainHandler";
import { ConsensusHandler } from "./ConsensusHandler";
import { CryptoHandler } from "./CryptoHandler";

import BaseNode from "../../simulation/BaseNode";
import BaseEvent from "../../simulation/BaseEvent";
import MessageEvent from "../../simulation/events/MessageEvent";
import TimeoutEvent from "../../simulation/events/TimeoutEvent";
import NodeStartEvent from "../../simulation/events/NodeStartEvent";
import bind from "bind-decorator";



export default class HonestNode extends BaseNode {
  protected mempool: Mempool;
  protected blockchain: Blockchain;
  protected decryptor: Decryptor;
  protected consensusEngine: ConsensusEngine;
  protected netInterface: NetworkInterface;
  protected mempoolHandler: MempoolHandler;
  protected blockchainHandler: BlockchainHandler;
  protected consensusHandler: ConsensusHandler;

  protected utils: Utils;


  // @bind
  // setDefaultInitialOrder(): void {
  //   const order: number[] = [];
  //   for (let i = 1; i <= this.scenario.numNodes; i++) {
  //     this.nodeOrder.push(i);
  //   }
  // }

  @bind
  onStart(event: NodeStartEvent): void {
    const order: number[] = [];
    // this.setDefaultInitialOrder();
    this.utils = new Utils(this.scenario.numNodes, this.nodeNumber);
    this.mempool = new Mempool();
    this.decryptor = new Decryptor();
    this.blockchain = new Blockchain();
    this.netInterface = new NetworkInterface();
    this.consensusEngine = new ConsensusEngine(this.decryptor, this.blockchain, this.mempool, this.netInterface);
    this.consensusHandler = new ConsensusHandler(this.consensusEngine, this.netInterface);
  }

  @bind
  onMessage(event: MessageEvent): void {
    const msg = <Message>event.message;
    switch (msg.type) {
      case "ConsensusMessage": {
        break;
      }
      case "MempoolMessage": {
        break;
      }
      case "BlockchainMessage": {
        break;
      }
      case "CryptoMessage": {
        break;
      }

    }
  }

  @bind
  onTimeout(event: TimeoutEvent): void {
    const msg = <Message>event.message;
    switch (msg.type) {

      case "ProposalStuckTimeout": {

        break;
      }
    }
  }

  @bind
  benchmarkGetClosedBlocks(): Block[] {
    return undefined;
  }

  @bind
  benchmarkAreClosedBlocksIdentical(block1: Block, block2: Block): boolean {
    return block1.content == block2.content;
  }

}
