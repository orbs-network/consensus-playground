import * as _ from "lodash";
import OrbsScenario from "../scenarios/oa-pbft/OrbsScenario";
import { OrbsExpConfig, ConnectionParams } from "../scenarios/oa-pbft/OrbsScenario";
import { NetworkConfiguration } from "../scenarios/oa-pbft/OrbsScenario";

export interface ScenarioConfig {
  name: string;
  randomSeed: string;
  algorithmName: string;
  orbsExpConfig: OrbsExpConfig;
}

export interface ScenarioResults {
  scenarioName: string;
  randomSeed: string;
  algorithmName: string;
  numNodes: number;
  committeeSize: number;
  numByz: number;
  thresholdSize: number;
  proposalTimeLimitMs: number;
  totalWarnings: number;
  totalErrors: number;
  forks: boolean;
  maxTimestampMs: number;
  minClosedBlocks: number;
  maxClosedBlocks: number;
  nodeBandwidths: number[];
  baseMessageSizeBytes: number;
  etxSizeBytes: number;
  numEtxsPerBlock: number;
  etxShareBytes: number;
  totalSentMessages: number;
  totalSentBytes: number;
  minMessagesPerNode: number;
  maxMessagesPerNode: number;
  numBroadcasts: number;
  numUnicasts: number;
  numMulticasts: number;

}

function convertToConnectivityMatrix(jsonMat: any): ConnectionParams[][] {
  const connectionParams = [];
  console.log(`jsonmat is ${JSON.stringify(jsonMat)}`);
  console.log(`jsonMat[0].length is ${jsonMat[0].length}`);
  for (const i of _.range(jsonMat.length)) {
    connectionParams[i] = [];
    for (const j of _.range(jsonMat[0].length)) {
      console.log(`jsonMat[i][j]["min_delay_ms"] is ${jsonMat[i][j]["min_delay_ms"]}`);
      connectionParams[i][j] = { minDelayMs: jsonMat[i][j]["min_delay_ms"], maxDelayMs: jsonMat[i][j]["max_delay_ms"] };
    }
  }
  return connectionParams;

}
export function loadScenarioConfigJSON(scenJsonString: string): ScenarioConfig {
  const scenJson = JSON.parse(scenJsonString);
  const connectionParams = convertToConnectivityMatrix(scenJson["exp_config"]["net_config"]["c_mat"]);
  console.log(`cmat is ${JSON.stringify(connectionParams)}`);
  const networkConfiguration: NetworkConfiguration = new NetworkConfiguration(scenJson["exp_config"]["net_config"]["node_bandwidths"], scenJson["exp_config"]["net_config"]["node_regions"], connectionParams, scenJson["exp_config"]["net_config"]["etx_size_bytes"], scenJson["exp_config"]["net_config"]["etx_share_bytes"],  scenJson["exp_config"]["net_config"]["num_etx_per_block"], scenJson["exp_config"]["net_config"]["msg_size_bytes"]);
  const orbsExpConfig: OrbsExpConfig = { name: scenJson["exp_config"]["name"], nNodesToCreate: scenJson["exp_config"]["n"], committeeSize: scenJson["exp_config"]["m"], numByz: scenJson["exp_config"]["f"], sharingThreshold: scenJson["exp_config"]["k"], proposalTimeoutMs: scenJson["exp_config"]["p_time_limit"], faultyNodeName: scenJson["exp_config"]["faulty_name"], networkConfiguration: networkConfiguration };
  const scenarioConfig: ScenarioConfig = { name: scenJson["name"], randomSeed: scenJson["random_seed"], algorithmName: scenJson["algorithm_name"], orbsExpConfig: orbsExpConfig };
  return scenarioConfig;

}
