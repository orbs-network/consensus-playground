import * as _ from "lodash";
import bind from "bind-decorator";
import { NetworkInterface } from "./NetworkInterface";
import Random from "../../simulation/Random";

export class Mempool {
  protected netInterface: NetworkInterface;
  protected randomizer: Random;

  constructor(randomizer: Random) {
    this.randomizer = randomizer;
  }

  @bind
  generateContent(): number {
    return this.randomizer.next();
  }


}
