import * as seedrandom from "seedrandom";
import bind from "bind-decorator";

export default class Random {
  protected randomizer: seedrandom.prng;

  constructor(seed: string = "seed") {
    this.randomizer = seedrandom(seed);
  }

  @bind
  next(): number {
    return this.randomizer();
  }
  
}
