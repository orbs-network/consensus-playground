import * as _ from "lodash";
import { Message, CryptoMessageType } from "./common";
import { Decryptor } from "./Decryptor";
import { NetworkInterface } from "./NetworkInterface";
import bind from "bind-decorator";


export class CryptoHandler {
  protected decryptor: Decryptor;
  protected netInterface: NetworkInterface;

  constructor(decryptor: Decryptor, netInterface: NetworkInterface) {
    this.decryptor = decryptor;
    this.netInterface = netInterface;
  }

  @bind
  handleMessage(msg: Message): void {
    switch (msg.cryptoMsgType) {
      case CryptoMessageType.BlockShare: {
        this.decryptor.handleBlockShare(msg);
        // this.decryptor.handleBlockShare(msg.blockShare);

        // TODO relay this to other nodes using fast forward protocol
        break;
      }


    }
    return;
  }

}
