import * as path from "path";
import * as shell from "shelljs";
import { ScenarioModule } from "./simulation/BaseScenario";

function showUsage() {
  console.log(`Usage: node dist <scenario> [random-seed]`);
  console.log(`Example: node dist naive-fast-round-robin-leader/happy-flow seed1`);
  console.log();
  console.log(`Available scenarios:`);
  for (const file of shell.ls("-d", "src/scenarios/*/*")) {
    console.log(` ${file.slice("src/scenarios/".length, -3)}`);
  }
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
  console.log(`\nERROR: scenario not provided, exiting`);
  showUsage();
  process.exit();
}

const scenarioName = process.argv[2];
const Scenario = loadScenario(scenarioName);
if (!Scenario) {
  console.log(`\nERROR: scenario with name '${scenarioName}' not found, exiting`);
  showUsage();
  process.exit();
}

const randomSeed = process.argv[3] || "seed";
const scenario = new Scenario(randomSeed);
scenario.start();
