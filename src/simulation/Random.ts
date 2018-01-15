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

  @bind
  nextIntegerInRange(min: number, max: number): number {
    return Math.round((max - min) * this.randomizer() + min);
  }

  @bind
  shuffle(array: number[]): number[] {
    // based on https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
    let currentIndex = array.length;
    let temporaryValue = -1;
    let randomIndex = -1;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

      // Pick a remaining element...
      randomIndex = this.nextIntegerInRange(0, (currentIndex - 1)); // inclusive
      currentIndex -= 1;

      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }

    return array;
  }

}
