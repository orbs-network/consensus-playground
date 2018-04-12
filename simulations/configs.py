#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Created on Thu Mar 29 11:22:14 2018

@author: ronent
"""
from pathlib import Path

root = Path(__file__).parent.parent.absolute()
exp_dir = Path('exps')
simulator_script = 'dist oa-benchmark-multi'
results_marker = '## Final Statistics ##:'


KEY_NM_FACTOR = 'nm_factor'
KEY_M = 'm'
KEY_BYZ_SETTING = 'byz_setting'
KEY_SCEN_NAME = 'name'
KEY_KF_FACTOR = 'kf_factor'
KEY_NUM_ETX_BLOCK = 'num_etx_per_block'
KEY_PROPOSAL_TIME_LIMIT = 'p_time_limit'
KEY_NET_TYPE = 'network_type'
KEY_NODE_BW = 'node_bandwidths'
KEY_FAULTY_NODE_NAME = 'faulty_name'
KEY_NET_MIN_DELAY = 'net_min_delay_ms'
KEY_NET_MAX_DELAY = 'net_max_delay_ms'
KEY_MSG_SIZE = 'msg_size_bytes'
KEY_ETX_SIZE = 'etx_size_bytes'
KEY_SHARE_SIZE = 'etx_share_bytes'
KEY_NUM_REGIONS = 'node_regions'
KEY_RANDOM_SEED = 'random_seed'
KEY_ALG_NAME = 'algorithm_name'

defaults = {
    KEY_NM_FACTOR: 2,
    KEY_M: 7,
    KEY_SCEN_NAME: 'test',
    KEY_ALG_NAME: 'oa-pbft',
    KEY_KF_FACTOR: 1,
    KEY_NUM_ETX_BLOCK: 1000,
    KEY_PROPOSAL_TIME_LIMIT: 4000,
    KEY_NODE_BW: 1000000000,
    KEY_NET_MIN_DELAY: 10,
    KEY_NET_MAX_DELAY: 370,
    KEY_MSG_SIZE: 500,
    KEY_ETX_SIZE: 250,
    KEY_SHARE_SIZE: 60,
    KEY_NUM_ETX_BLOCK: 1000,
    KEY_PROPOSAL_TIME_LIMIT: 4000,
    KEY_NUM_REGIONS: 1,
    KEY_NET_TYPE: 'simple',
    KEY_RANDOM_SEED: '433423',
    KEY_BYZ_SETTING: 'max',
    KEY_FAULTY_NODE_NAME: 'HonestNode'
        }

