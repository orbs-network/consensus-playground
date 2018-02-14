import * as _ from "lodash";
import * as path from "path";
import * as shell from "shelljs";
import BenchmarkOutput from "./BenchmarkOutput";
import { OrbsScenarioWithNodeModule } from "./BaseOrbsScenarioWithNode";
import { NodeModule } from "../simulation/BaseNode";
import Statistics from "../simulation/Statistics";

const fs = require("fs");
const dir = "simulations/oa-benchmark-output";
const now = new Date(Date.now());
const outFile = `${dir}/benchmark_${now.toISOString().replace(`:`, `.`).replace(`:`, `.`)}.html`; // 2 types of ':' for some reason...
function loadScenario(scenarioName: string): typeof OrbsScenarioWithNodeModule {
  try {
    return require(`./scenarios/${scenarioName}`).default;
  } catch (e) {
    return undefined;
  }
}

function loadHonestNode(algorithmName: string): typeof NodeModule {
  try {
    return require(`../algorithms/${algorithmName}`).HonestNode;
  } catch (e) {
    return undefined;
  }
}

function loadFaultyNode(algorithmName: string): typeof NodeModule {
  try {
    return require(`../algorithms/${algorithmName}`).FaultyNode;
  } catch (e) {
    return undefined;
  }
}

// create output directory for results, if it doesn't already exist
fs.existsSync(dir) || fs.mkdirSync(dir);


const output = new BenchmarkOutput();
output.start();
for (const file of shell.ls("-d", "src/oa-benchmark/scenarios/*")) {
  const scenarioName = file.slice("src/oa-benchmark/scenarios/".length, -3);
  const Scenario = loadScenario(scenarioName);
  output.startScenario(scenarioName);
  console.log(`\n${scenarioName}\n`);
  for (const file of shell.ls("-d", "src/algorithms/oa-[a-z]*")) {
    const algorithmName = file.slice("src/algorithms/".length);
    console.log(`\n${algorithmName}\n`);
    const Node = loadHonestNode(algorithmName);
    const FaultyNode = loadFaultyNode(algorithmName);
    const randomSeed = "benchmark";
    const configs = Scenario.configs();
    for (const config of configs) {
      const scenario = new Scenario(randomSeed, Node, FaultyNode, config);
      const configName = algorithmName + "/" + config.name;
      scenario.start();
      output.addAlgorithm(configName);
      output.addAlgorithmResult(configName, "# Nodes", scenario.numNodes.toString());
      output.addAlgorithmResult(configName, "# Committee Members", scenario.committeeSize.toString());
      output.addAlgorithmResult(configName, "# Byzantine", scenario.numByz.toString());
      output.addAlgorithmResult(configName, "threshold size", scenario.sharingThreshold.toString());
      output.addAlgorithmResult(configName, "warnings", scenario.statistics.totalWarnings.toString());
      output.addAlgorithmResult(configName, "errors", scenario.statistics.totalErrors.toString());
      output.addAlgorithmResult(configName, "forks", Statistics.hasForks(scenario) ? "yes" : "no");
      output.addAlgorithmResult(configName, "max timestamp", scenario.statistics.maxTimestampMs.toString());
      output.addAlgorithmResult(configName, "closed blocks", Statistics.minClosedBlocks(scenario).toString() + " - " + Statistics.maxClosedBlocks(scenario).toString());
      output.addAlgorithmResult(configName, "total messages", scenario.statistics.totalSentMessages.toString());
      output.addAlgorithmResult(configName, "total bytes", scenario.statistics.totalSentBytes.toString());
      output.addAlgorithmResult(configName, "messages/node", (_.min(scenario.statistics.totalReceivedMessagesPerNode) || 0).toString() + " - " + (_.max(scenario.statistics.totalReceivedMessagesPerNode) || 0).toString());
      output.addAlgorithmResult(configName, "broadcasts", scenario.statistics.totalBroadcasts.toString());
      output.addAlgorithmResult(configName, "unicasts", scenario.statistics.totalUnicasts.toString());
    }


  }
  output.endScenario();
}
output.end();

shell.echo(output.get()).to(outFile);
shell.exec(`open ${outFile}`);
