import BaseScenario from "./BaseScenario";
import * as colors from "colors";
import * as _ from "lodash";
import bind from "bind-decorator";

const DEBUG = 1;
const INFO = 2;
const WARN = 3;
const DEBUG_THRESHOLD = 2;

export default class Logger {
  protected loggerIdString: string;
  protected scenario: BaseScenario;
  protected debugThreshold: number;
  protected debugLevel: number;
  protected infoLevel: number;
  protected warnLevel: number;


  constructor(idString: string, scenario: BaseScenario) {
    this.loggerIdString = idString;
    this.scenario = scenario;
    this.debugThreshold = DEBUG_THRESHOLD;
    this.debugLevel = DEBUG;
    this.infoLevel = INFO;
    this.warnLevel = WARN;
  }


  @bind
  getDebugThreshold(): number {
    return this.debugThreshold;
  }


  @bind
  log(str: string, log_level?: number): void {
    if ((INFO >= DEBUG_THRESHOLD) || (log_level && log_level >= DEBUG_THRESHOLD)) {
      const timestamp = _.padStart(this.scenario.currentTimestamp.toString(), 6, "0");
      console.log(`[${timestamp}] ${this.loggerIdString}: ${str}`);
    }
  }


  @bind
  warn(str: string): void {
    if (WARN >= DEBUG_THRESHOLD) {
      const timestamp = _.padStart(this.scenario.currentTimestamp.toString(), 6, "0");
      console.log(colors.yellow.bold(`[${timestamp}] WARNING! ${this.loggerIdString}: ${str}`));
    }
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
    if (DEBUG >= DEBUG_THRESHOLD) {
      const timestamp = _.padStart(this.scenario.currentTimestamp.toString(), 6, "0");
      console.log(colors.grey(`[${timestamp}] DEBUG: ${this.loggerIdString}: ${str}`));
    }
  }

}
