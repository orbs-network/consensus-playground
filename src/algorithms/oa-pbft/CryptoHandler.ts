import * as _ from "lodash";
import { Message } from "./common";
import { Decryptor } from "./Decryptor";
import { NetworkInterface } from "./NetworkInterface";
import bind from "bind-decorator";


export class CryptoHandler {
  protected decryptor: Decryptor;
  protected netInterface: NetworkInterface;

  @bind
  handleMessage(msg: Message): void {
    return;
  }

}
