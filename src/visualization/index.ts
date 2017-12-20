import * as _ from "lodash";
import * as path from "path";
import * as shell from "shelljs";
import VisualizationOutput from "./VisualizationOutput";
import Statistics from "../simulation/Statistics";
import { ScenarioModule } from "../simulation/BaseScenario";

function loadScenario(scenarioName: string): typeof ScenarioModule {
  try {
    return require(`../scenarios/${scenarioName}`).default;
  } catch (e) {
    return undefined;
  }
}

const intervalMs = _.parseInt(process.argv[3]);
if (_.isNaN(intervalMs) || intervalMs <= 0) {
  console.log(`\nERROR: interval '${intervalMs}' is not a valid positive integer`);
  process.exit();
}

const scenarioName = process.argv[4];
const Scenario = loadScenario(scenarioName);
if (!Scenario) {
  console.log(`\nERROR: scenario with name '${scenarioName}' not found, exiting`);
  process.exit();
}

const randomSeed = process.argv[5] || "seed";
const scenario = new Scenario(randomSeed);
scenario.statistics.shouldRecordMessagesByInterval = intervalMs;
scenario.start();

const output = new VisualizationOutput(scenario.numNodes, scenario.statistics, scenarioName);
output.render();

shell.echo(output.get()).to("visualization.html");
shell.exec("open visualization.html");
