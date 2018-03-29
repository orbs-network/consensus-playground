#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Created on Thu Mar 29 11:20:55 2018

@author: ronent
"""

from configs import *
import numpy as np
import jsonpickle

class NetworkConfiguration(object):
    def __init__(self, n, etx_size_bytes=DEFAULT_ETX_SIZE_BYTES, num_etx_per_block=DEFAULT_NUM_ETX_PER_BLOCK, bandwidth_bits_sec=DEFAULT_BANDWIDTH_BITS_SEC, msg_size_bytes=DEFAULT_MSG_SIZE_BYTES, etx_share_bytes=DEFAULT_SHARE_SIZE_BYTES, num_regions=1, c_mat="default"):
        self.num_nodes = n
        self.num_regions = num_regions
        self.etx_size_bytes = etx_size_bytes
        self.num_etx_per_block = num_etx_per_block
        self.bandwidth_bits_sec = bandwidth_bits_sec
        self.msg_size_bytes = msg_size_bytes
        self.etx_share_bytes = etx_share_bytes
        self.node_bandwidths = n * [bandwidth_bits_sec]
        self.node_regions = n * [0]
        self.c_mat = [[{"min_delay_ms": NETWORK_MIN_DELAY_MS, "max_delay_ms":NETWORK_MAX_DELAY_MS} for i in range(num_regions)] for j in range(num_regions)]
        

        

class ExperimentConfiguration(object):
    def __init__(self, name, n, m, f, k, p_time_limit, faulty_name, net_config):
        self.n = n
        self.m = m
        self.f = f
        self.k = k
        self.p_time_limit = p_time_limit
        self.faulty_name = faulty_name
        self.net_config = net_config

class ScenarioConfig(object):
    def __init__(self, name, random_seed, algorithm_name, exp_config):
        self.name = name
        self.random_seed = random_seed
        self.algorithm_name = algorithm_name
        self.exp_config = exp_config
        
    
if __name__ == "__main__":
    nc = NetworkConfiguration(10)
    ec = ExperimentConfiguration("test", 10, 7, 1, 3, 10000, "HonestNode", nc)
    sc = ScenarioConfig("testScenario", "seed", "oa-pbft", ec)
    pickled = jsonpickle.encode(sc)
    print(pickled)
        
        