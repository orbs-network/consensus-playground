import * as _ from "lodash";
import { Message, Cmap, Utils, Block, EncryptedBlock, DecryptedBlock, BlockProof, ConsensusMessageType, Proposal } from "./common";
import * as Common from "./common";
import Logger from "../../simulation/Logger";
import { Blockchain } from "./Blockchain";
import { Decryptor } from "./Decryptor";
import { Mempool } from "./Mempool";
import { Timer } from "./Timer";
import { NetworkInterface } from "./NetworkInterface";
import { ConsensusEngine } from "./ConsensusEngine";


import bind from "bind-decorator";

const PROPOSAL_TIMER_MS = 2000;
const FAULTY_PROB = 0.8;
enum Phase { // not used yet
    Agreeing,
    Waiting,
    Decrypting
}

// contains current PBFT state information
export interface PBFTState {
  view: number;
  candidateEBlock: EncryptedBlock;
  outOfSyncMessages: Message[];
  prepMessages: Message[];
  commitMessages: Message[];
  prepared: boolean;
  committedLocal: boolean;
  blockProof: BlockProof;
  viewChangeMessages: Message[];
  collectingViewChangeMsgs: boolean;
}



export class FaultyPreparedConsensusEngine extends ConsensusEngine {

  constructor(nodeNumber: number, decryptor: Decryptor, blockchain: Blockchain, mempool: Mempool, netInterface: NetworkInterface, utils: Utils, logger: Logger = undefined, timer: Timer = undefined) {
    super(nodeNumber, decryptor, blockchain, mempool, netInterface, utils, logger, timer);
    this.sleeping = false;
  }

  @bind
  enterPrepared(): void {
    if (this.isSleeping()) {
      return;
    }
    if (this.utils.scenario.randomizer.next() < FAULTY_PROB ) {
      this.logger.warn(`Entering Prepared stage. Oh no, I'm going offl-`);
      this.timer.setWakeupTimer(this.utils.scenario.randomizer.nextIntegerInRange(PROPOSAL_TIMER_MS, 3 * PROPOSAL_TIMER_MS / 2));
      this.sleeping = true;
    }
    else {
      super.enterPrepared();
    }
  }



}
