import * as path from "path";
import * as shell from "shelljs";
import BenchmarkOutput from "./BenchmarkOutput";
import { ScenarioWithNodeModule } from "./BaseScenarioWithNode";
import { NodeModule } from "../simulation/BaseNode";

function loadScenario(scenarioName: string): typeof ScenarioWithNodeModule {
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

const output = new BenchmarkOutput();
output.start();
for (const file of shell.ls("-d", "src/benchmark/scenarios/*")) {
  const scenarioName = file.slice("src/benchmark/scenarios/".length, -3);
  const Scenario = loadScenario(scenarioName);
  output.startScenario(scenarioName);
  for (const file of shell.ls("-d", "src/algorithms/*")) {
    const algorithmName = file.slice("src/algorithms/".length);
    const Node = loadHonestNode(algorithmName);
    const randomSeed = "benchmark";
    const scenario = new Scenario(randomSeed, Node);
    scenario.start();
    output.addAlgorithm(algorithmName);
    output.addAlgorithmResult(algorithmName, "warnings", scenario.statistics.totalWarnings.toString());
    output.addAlgorithmResult(algorithmName, "errors", scenario.statistics.totalErrors.toString());
    output.addAlgorithmResult(algorithmName, "max timestamp", scenario.statistics.maxTimestampMs.toString());
    output.addAlgorithmResult(algorithmName, "messages", scenario.statistics.totalSentMessages.toString());
  }
  output.endScenario();
}
output.end();

shell.echo(output.get()).to("benchmark.html");
shell.exec("open benchmark.html");
