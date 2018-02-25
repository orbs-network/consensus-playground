import * as _ from "lodash";
import { Utils, Block, Message, SyncerMessageType } from "./common";
import { ConsensusHandler } from "./ConsensusHandler";
import { CryptoHandler } from "./CryptoHandler";
import { MempoolHandler } from "./MempoolHandler";
import { BlockchainHandler } from "./BlockchainHandler";
import { NetworkInterface } from "./NetworkInterface";

import bind from "bind-decorator";

export class Syncer {

  protected mempoolHandler: MempoolHandler;
  protected blockchainHandler: BlockchainHandler;
  protected consensusHandler: ConsensusHandler;
  protected cryptoHandler: CryptoHandler;
  protected peers: number[];
  public syncing: boolean;
  public netInterface: NetworkInterface;

  protected utils: Utils;

  constructor(mempoolHandler: MempoolHandler, blockchainHandler: BlockchainHandler, consensusHandler: ConsensusHandler, cryptoHandler: CryptoHandler, netInterface: NetworkInterface, utils: Utils) {

    this.consensusHandler = consensusHandler;
    this.mempoolHandler = mempoolHandler;
    this.blockchainHandler = blockchainHandler;
    this.cryptoHandler = cryptoHandler;
    this.netInterface = netInterface;

    this.utils = utils;
    this.peers = [];
    this.syncing = false;

  }

/**
 * Select f+1 peers for syncing.
 */
  @bind
  init(): void {
    // list of peers excluding myself
    const allPeers = _.range(1, this.utils.numNodes + 1).filter(x => x != this.utils.nodeNumber);
    this.peers = this.utils.scenario.randomizer.choice(allPeers, this.utils.numByz + 1);
    this.utils.logger.debug(`Syncer selected peers: ${this.peers}`);
  }

  @bind
  handleMessage(msg: Message): void {
    switch (msg.syncerMsgType) {
      case SyncerMessageType.RequestSync: {
        this.handleRequestSync(msg);
        break;
      }
      case SyncerMessageType.SyncPeer: {
        this.handleSyncPeerMsg(msg);
        break;
      }


    }
    return;
  }

  @bind
  requestSync(): void {
    const atTerm = this.blockchainHandler.blockchain.getLastBlock().term;
    this.syncing = true;
    const requestSyncMsg: Message = { sender: this.utils.nodeNumber, type: "SyncMessage" + "/" + SyncerMessageType.RequestSync, syncerMsgType: SyncerMessageType.RequestSync, term: atTerm };
    this.netInterface.unicast(this.peers[0], requestSyncMsg); // TODO replace with multicast after merge
    this.utils.logger.debug(`Sending requestSync, ${JSON.stringify(requestSyncMsg)}...`);
  }

  @bind
  handleRequestSync(msg: Message): void {
    // TODO not validating at this stage
    const myLastClosedTerm = this.blockchainHandler.blockchain.getLastBlock().term;
    this.utils.logger.debug(`Received requestSync message from peer ${msg.sender}`);
    if (msg.term >= myLastClosedTerm) {
      this.utils.logger.debug(`At term ${msg.term}, I'm at ${myLastClosedTerm} - can't help him...`);
      this.sendBlocks([], msg.sender);
      return;
    }
    this.sendBlocks(_.range(msg.term + 1, myLastClosedTerm + 1), msg.sender);
  }

  @bind
  isValidBlock(block: Block): boolean {
    // TODO implement.
    return true;
  }

  @bind
  handleSyncPeerMsg(msg: Message): void {
    this.utils.logger.debug(`Received syncing message ${JSON.stringify(msg)}`);
    // TODO sort blocks
    for (const block of msg.blocks) {
      if (!this.isValidBlock(block)) {
        continue;
      }
      if (block.term <= this.blockchainHandler.blockchain.getLastBlock().term) {
        continue;
      }
      this.consensusHandler.consensusEngine.handleNewBlock(block, true);
      this.cryptoHandler.decryptor.reset();

    }
    this.syncing = false;
    this.utils.logger.log(`Finished syncing.`);
  }

  @bind
  sendBlocks(blockIDs: number[], toNode: number): void {
    // TODO for more accurate results you could just send EB,BP and SBs and save on sending DB
    const blockIDsToSend = blockIDs.sort((a, b) => a - b);


    const syncPeerMsg: Message = { type: "SyncMessage" + "/" + SyncerMessageType.SyncPeer, sender: this.utils.nodeNumber, term: this.consensusHandler.consensusEngine.getTerm(), syncerMsgType: SyncerMessageType.SyncPeer, blocks: this.blockchainHandler.blockchain.getBlocksRange(blockIDs[0], blockIDs[blockIDs.length - 1])  };
    this.netInterface.unicast(toNode, syncPeerMsg);
    this.utils.logger.debug(`Sending blocks ${blockIDsToSend} to peer ${toNode}: ${JSON.stringify(syncPeerMsg)}`);
  }


}
