import * as _ from "lodash";
import * as path from "path";
import * as shell from "shelljs";
import BenchmarkOutput from "./BenchmarkOutput";
// import { OrbsScenarioWithNodeModule } from "./BaseOrbsScenarioWithNode";
import BaseOrbsScenarioWithNode from "./BaseOrbsScenarioWithNode";
import { NodeModule } from "../simulation/BaseNode";
import Statistics from "../simulation/Statistics";

const fs = require("fs");
const dir = "simulations/oa-benchmark-output";
const now = new Date(Date.now());

function loadScenario(scenarioName: string): typeof BaseOrbsScenarioWithNode {
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

function loadTestNode(algorithmName: string): typeof NodeModule {
  try {
    return require(`../algorithms/${algorithmName}`).TestNode;
  } catch (e) {
    return undefined;
  }
}


// TODO replace this with a more elegant way to load modules
function loadFaultyNode(algorithmName: string, faultyNodeName: string): typeof NodeModule {
  try {
    switch (faultyNodeName) {
      case "FaultyNode": {
        return require(`../algorithms/${algorithmName}`).FaultyNode;
      }
      case "FaultyForFewTermsNode": {
        return require(`../algorithms/${algorithmName}`).FaultyForFewTermsNode;
      }
      default: {
        return require(`../algorithms/${algorithmName}`).FaultyNode;
      }

    }

  } catch (e) {
    return undefined;
  }
}


// create output directory for results, if it doesn't already exist
fs.existsSync(dir) || fs.mkdirSync(dir);


const output = new BenchmarkOutput();
output.start();
let outputToFile = false;
if (process.argv[3] == "v") {
  console.log(`verbose`);
  outputToFile = true;
}

for (const file of shell.ls("-d", "src/oa-benchmark/scenarios/*")) {
  const scenarioName = file.slice("src/oa-benchmark/scenarios/".length, -3);
  if (scenarioName == "oa-testing") {
    continue;
  }
  const Scenario = loadScenario(scenarioName);
  output.startScenario(scenarioName);
  console.log(`\n${scenarioName}\n`);
  for (const file of shell.ls("-d", "src/algorithms/oa-[a-z]*")) {
    const algorithmName = file.slice("src/algorithms/".length);
    console.log(`\n${algorithmName}\n`);
    const Node = loadHonestNode(algorithmName);
    const TestNode = loadTestNode(algorithmName);
    const randomSeed = "benchmark4";
    const configs = Scenario.configs();
    for (const config of configs) {
      const FaultyNode = loadFaultyNode(algorithmName, config.faultyNodeName);
      const scenario = new Scenario(randomSeed, Node, TestNode, FaultyNode, config);
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
      output.addAlgorithmResult(configName, "BW per node (Mbits/sec)", (scenario.oaConfig.networkConfiguration.nodeBandwidths[0] / 1000000).toString()); // TODO mix and min, assuming all same here
      output.addAlgorithmResult(configName, "base message size (bytes)", scenario.oaConfig.networkConfiguration.defaultMsgSizeBytes.toString());
      output.addAlgorithmResult(configName, "etx size (bytes)", scenario.oaConfig.networkConfiguration.etxSizeBytes.toString());
      output.addAlgorithmResult(configName, "number of etxs / block", scenario.oaConfig.networkConfiguration.numEtxsPerBlock.toString());
      output.addAlgorithmResult(configName, "share size (bytes)", scenario.oaConfig.networkConfiguration.etxShareBytes.toString());
      output.addAlgorithmResult(configName, "total sent messages", scenario.statistics.totalSentMessages.toString());
      output.addAlgorithmResult(configName, "total bytes", scenario.statistics.totalSentBytes.toString()); // TODO replace this with message sizes
      output.addAlgorithmResult(configName, "messages/node", (_.min(scenario.statistics.totalReceivedMessagesPerNode) || 0).toString() + " - " + (_.max(scenario.statistics.totalReceivedMessagesPerNode) || 0).toString());
      output.addAlgorithmResult(configName, "broadcasts", scenario.statistics.totalBroadcasts.toString());
      output.addAlgorithmResult(configName, "unicasts", scenario.statistics.totalUnicasts.toString());
      output.addAlgorithmResult(configName, "multicasts", scenario.statistics.totalMulticasts.toString());
      console.log(`%%%%%% Config ${configName}/${configs.length}`);
      for (const node of scenario.nodes) {
        const closedBlocks = node.benchmarkGetClosedBlocks();
        console.log(`%%%%%% Node ${node.nodeNumber}   Blocks: `);
        for (const block of closedBlocks) {
          console.log(`${block.term} - ${block.encryptedBlock.hash}`);
        }

      }
    }


  }
  output.endScenario();
  // break;
}
output.end();
const outFile = (outputToFile) ? `${dir}/benchmark_${now.toISOString().replace(`:`, `.`).replace(`:`, `.`)}.html` : `${dir}/benchmark.html`; // 2 types of ':' for some reason...
shell.echo(output.get()).to(outFile);
shell.exec(`open ${outFile}`);
