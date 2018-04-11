import * as _ from "lodash";
import * as path from "path";
import * as shell from "shelljs";
import BaseOrbsScenarioWithNode from "./BaseOrbsScenarioWithNode";
import { NodeModule } from "../simulation/BaseNode";
import { ScenarioConfig, ScenarioResults, loadScenarioConfigJSON } from "./ScenarioConfig";
import Statistics from "../simulation/Statistics";

const fs = require("fs");
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

function loadScenarioJSONFile(jsonFileName: string): ScenarioConfig {
  const scenarioConfig: ScenarioConfig = loadScenarioConfigJSON(jsonFileName);
  return scenarioConfig;
}

function runScenario(scenarioConfig: ScenarioConfig): ScenarioResults {
  console.log(`\n${scenarioConfig.name}\n`);
  console.log(`\n${scenarioConfig.algorithmName}\n`);
  const Scenario = loadScenario(scenarioConfig.name);
  const Node = loadHonestNode(scenarioConfig.algorithmName);
  const TestNode = loadTestNode(scenarioConfig.algorithmName);
  const FaultyNode = loadFaultyNode(scenarioConfig.algorithmName, scenarioConfig.orbsExpConfig.faultyNodeName);
  const scenario = new Scenario(scenarioConfig.randomSeed, Node, TestNode, FaultyNode, scenarioConfig.orbsExpConfig);
  const configName = scenarioConfig.algorithmName + "/" + scenarioConfig.orbsExpConfig.name;
  scenario.start();

  return getScenarioResults(scenarioConfig, scenario);
}

function getScenarioResults(scenarioConfig: ScenarioConfig, scenario: BaseOrbsScenarioWithNode): ScenarioResults {
  const scenarioResults: ScenarioResults = { scenarioName: scenarioConfig.name,
  randomSeed: scenarioConfig.randomSeed,
  algorithmName: scenarioConfig.algorithmName,
  numNodes: scenario.numNodes,
  committeeSize: scenario.committeeSize,
  numByz: scenario.numByz,
  thresholdSize: scenario.sharingThreshold,
  proposalTimeLimitMs: scenario.oaConfig.proposalTimeoutMs,
  totalWarnings: scenario.statistics.totalWarnings,
  totalErrors: scenario.statistics.totalErrors,
  forks: Statistics.hasForks(scenario),
  maxTimestampMs: scenario.statistics.maxTimestampMs,
  minClosedBlocks: Statistics.minClosedBlocks(scenario),
  maxClosedBlocks: Statistics.maxClosedBlocks(scenario),
  nodeBandwidths: scenario.oaConfig.networkConfiguration.nodeBandwidths,
  baseMessageSizeBytes: scenario.oaConfig.networkConfiguration.defaultMsgSizeBytes,
  etxSizeBytes: scenario.oaConfig.networkConfiguration.etxSizeBytes,
  numEtxsPerBlock: scenario.oaConfig.networkConfiguration.numEtxsPerBlock,
  etxShareBytes: scenario.oaConfig.networkConfiguration.etxShareBytes,
  totalSentMessages: scenario.statistics.totalSentMessages,
  totalSentBytes: scenario.statistics.totalSentBytes,
  minMessagesPerNode: (_.min(scenario.statistics.totalReceivedMessagesPerNode) || 0),
  maxMessagesPerNode: (_.max(scenario.statistics.totalReceivedMessagesPerNode) || 0),
  numBroadcasts: scenario.statistics.totalBroadcasts,
  numUnicasts: scenario.statistics.totalUnicasts,
  numMulticasts: scenario.statistics.totalMulticasts };
  return scenarioResults;
}





let outputToFile = false;

// Parse command line args
const scenJsonString = process.argv[3];

if (process.argv[4] == "v") {
  console.log(`verbose`);
  outputToFile = true;
}


// const scenarioConfig = require(`./${scenFilePath}`).scenarioConfig;
const scenarioConfig = loadScenarioConfigJSON(`${scenJsonString}`);

// create output directory for results, if it doesn't already exist
const dir = "simulations/oa-multi-benchmark-output";
const scenarioDir = dir + "/" + scenarioConfig.name;
fs.existsSync(scenarioDir) || fs.mkdirSync(scenarioDir);

const scenarioResults = runScenario(scenarioConfig);
let outFile = undefined;
// create output directory for results, if it doesn't already exist
if (outputToFile) {
  fs.existsSync(dir) || fs.mkdirSync(dir);
  outFile = `${scenarioDir}/${scenarioConfig.orbsExpConfig.name}_${now.toISOString().replace(`:`, `.`).replace(`:`, `.`)}.json`;
}
else {
  outFile = `${dir}/benchmark.json`; // 2 types of ':' for some reason...
}

shell.echo(JSON.stringify(scenarioResults)).to(outFile);
shell.exec(`open ${outFile}`);
