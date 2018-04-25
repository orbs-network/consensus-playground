# -*- coding: utf-8 -*-
"""
Spyder Editor

Some code to extract useful statistics from runs.

"""

import pandas as pd
        
        
if __name__ == "__main__":
    
    data_file = "exps/large_committee_faulties_exp/results.csv"
    
    node_bws = [1000]
    etx_size = 250
    threshold_factor = 1
    sim_time_limit_sec = 100
    
    n_nodes_keyname = 'numNodes'
    m_keyname = 'committeeSize'
    k_keyname= 'thresholdSize'
    byz_keyname = 'numByz'
    node_bws_keyname = 'nodeBandwidths'
    etx_size_keyname = 'etxSizeBytes'
    num_etx_per_block_keyname = 'numEtxsPerBlock'
    max_num_closed_keyname = 'maxClosedBlocks'
    min_num_closed_keyname = 'minClosedBlocks'
    
    num_closed_keyname = 'closed_blocks'
    tx_thrghpt_keyname = 'num_tx_sec'
    latency_keyname = 'block_latency'
    bw_node_keyname = 'node_bandwidth'
    
    results_df = pd.read_csv(data_file)
    results_df[num_closed_keyname] = (results_df[max_num_closed_keyname] + results_df[min_num_closed_keyname]) / 2
    
    # Assumning all node bandwidths are equal
    results_df[node_bws_keyname]  = results_df[node_bws_keyname].apply(lambda x: eval(x))
    results_df[bw_node_keyname] = results_df[node_bws_keyname].apply(lambda x: x[0] / 1000000) # Mbits / sec
    
#     find throughput  
    results_df[tx_thrghpt_keyname] = results_df[num_etx_per_block_keyname] * results_df[num_closed_keyname] / sim_time_limit_sec
    results_df[latency_keyname] =  sim_time_limit_sec / results_df[num_closed_keyname]
