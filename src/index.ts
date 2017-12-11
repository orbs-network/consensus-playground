import * as path from "path";
import * as shell from "shelljs";
import { ScenarioModule } from "./simulation/BaseScenario";

function showUsage() {
  console.log(`Usage: node dist <scenario> [random-seed]`);
  console.log(`Example: node dist naive-constant-leader/happy-flow seed1`);
  console.log();
}

function loadScenario(scenarioName: string): typeof ScenarioModule {
  try {
    return require(`./scenarios/${scenarioName}`).default;
  } catch (e) {
    return undefined;
  }
}

if (!process.argv[2]) {
  console.log(`ERROR: scenario not provided, exiting`);
  showUsage();
  process.exit();
}

const scenarioName = process.argv[2];
const Scenario = loadScenario(scenarioName);
if (!Scenario) {
  console.log(`ERROR: scenario with name '${scenarioName}' not found, exiting`);
  showUsage();
  process.exit();
}

const randomSeed = process.argv[3] || "seed";
const scenario = new Scenario(randomSeed);
scenario.start();
