import BaseScenario from "./BaseScenario";
import * as colors from "colors";
import * as _ from "lodash";
import bind from "bind-decorator";

const DEBUG = true;

export default class Logger {
  protected loggerIdString: string;
  protected scenario: BaseScenario;

  constructor(idString: string, scenario: BaseScenario) {
    this.loggerIdString = idString;
    this.scenario = scenario;
  }

  @bind
  log(str: string): void {
    const timestamp = _.padStart(this.scenario.currentTimestamp.toString(), 6, "0");
    console.log(`[${timestamp}] ${this.loggerIdString}: ${str}`);
  }

  @bind
  warn(str: string): void {
    const timestamp = _.padStart(this.scenario.currentTimestamp.toString(), 6, "0");
    console.log(colors.yellow.bold(`[${timestamp}] WARNING! ${this.loggerIdString}: ${str}`));
    this.scenario.statistics.totalWarnings++;
  }

  @bind
  error(str: string): void {
    const timestamp = _.padStart(this.scenario.currentTimestamp.toString(), 6, "0");
    console.log(colors.red.bold(`[${timestamp}] ERROR! ${this.loggerIdString}: ${str}`));
    this.scenario.statistics.totalErrors++;
  }

  @bind
  debug(str: string): void {
    if (DEBUG) {
      const timestamp = _.padStart(this.scenario.currentTimestamp.toString(), 6, "0");
      console.log(colors.grey(`[${timestamp}] DEBUG: ${this.loggerIdString}: ${str}`));
    }
  }

}
