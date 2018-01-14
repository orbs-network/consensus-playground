import * as _ from "lodash";
import { Utils, Block, Proposal } from "./common";
import { NetworkInterface } from "./NetworkInterface";
import { ConsensusEngine } from "./ConsensusEngine";
import { Blockchain } from "./Blockchain";
import bind from "bind-decorator";


export class Decryptor {
  protected blockchain: Blockchain;
  protected consensusEngine: ConsensusEngine;
  protected netInterface: NetworkInterface;

}
