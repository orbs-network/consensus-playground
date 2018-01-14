import * as _ from "lodash";
import { Utils, Block, Proposal } from "./common";
import { Blockchain } from "./Blockchain";
import { Decryptor } from "./Decryptor";
import { Mempool } from "./Mempool";
import { NetworkInterface } from "./NetworkInterface";

import bind from "bind-decorator";


export class ConsensusEngine {
  protected decryptor: Decryptor;
  protected blockchain: Blockchain;
  protected mempool: Mempool;
  protected netInterface: NetworkInterface;

  constructor(decryptor: Decryptor, blockchain: Blockchain, mempool: Mempool, netInterface: NetworkInterface) {
    this.decryptor = decryptor;
    this.blockchain = blockchain;
    this.mempool = mempool;
    this.netInterface = netInterface;

  }

}
