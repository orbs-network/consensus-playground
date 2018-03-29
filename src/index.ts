import * as path from "path";
import * as shell from "shelljs";
import { ScenarioModule } from "./simulation/BaseScenario";

function showUsage() {
  console.log(`Usage 1: node dist <scenario> [random-seed]`);
  console.log(`Example: node dist naive-fast-round-robin-leader/happy-flow seed1`);
  console.log();
  console.log(`Available scenarios:`);
  for (const file of shell.ls("-d", "src/scenarios/*/*")) {
    console.log(` ${file.slice("src/scenarios/".length, -3)}`);
  }
  console.log();
  console.log(`Usage 2: node dist benchmark`);
  console.log(`Will run all algorithms in algorithms folder that begin with [a-z], use this to ignore algorithms (by appending '_' to the beginning for example).`);
  console.log();
  console.log(`Usage 3: node dist oa-benchmark`);
  console.log(`Will run all algorithms beginning with "src/algorithms/oa-", on the scenarios in the "src/oa-benchmark" folder. Output will be to the folder 'simulations/oa-benchmark-output/benchmark.html'. Use 'node dist oa-benchmark v' for output to unique file indexed by current time.`);
  console.log();
  console.log(`Usage 4: node dist visualize <interval-ms> <scenario> [random-seed]`);
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
if (scenarioName === "benchmark") {
  require("./benchmark");
  process.exit();
}

if (scenarioName === "oa-benchmark") {
  require("./oa-benchmark");
  process.exit();
}

if (scenarioName === "oa-benchmark-multi") {
  require("./oa-benchmark-multi");
  process.exit();
}

if (scenarioName === "visualize") {
  require("./visualization");
  process.exit();
}

const Scenario = loadScenario(scenarioName);
if (!Scenario) {
  console.log(`\nERROR: scenario with name '${scenarioName}' not found, exiting`);
  showUsage();
  process.exit();
}

const randomSeed = process.argv[3] || "seed";
const scenario = new Scenario(randomSeed);
scenario.start();
