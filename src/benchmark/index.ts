import * as path from "path";
import * as shell from "shelljs";
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

let html = "";

for (const file of shell.ls("-d", "src/benchmark/scenarios/*")) {
  const scenarioName = file.slice("src/benchmark/scenarios/".length, -3);
  const Scenario = loadScenario(scenarioName);

  html += `
<h2>${scenarioName}</h2>
<table>
  <tr>
    <th>algorithm</th>
    <th>warnings</th>
    <th>errors</th>
    <th>max timestamp</th>
    <th>messages</th>
  </tr>`;

  for (const file of shell.ls("-d", "src/algorithms/*")) {
    const algorithmName = file.slice("src/algorithms/".length);
    const Node = loadHonestNode(algorithmName);

    const randomSeed = "benchmark";
    const scenario = new Scenario(randomSeed, Node);
    scenario.start();
    html += `
  <tr>
    <td>${algorithmName}</td>
    <td>${scenario.statistics.totalWarnings}</td>
    <td>${scenario.statistics.totalErrors}</td>
    <td>${scenario.statistics.maxTimestampMs}</td>
    <td>${scenario.statistics.totalSentMessages}</td>
  </tr>`;
  }

  html += `
</table>
`;

}

shell.echo(html).to("benchmark.html");
shell.exec("open benchmark.html");
