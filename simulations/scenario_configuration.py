#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Created on Thu Mar 29 11:20:55 2018

@author: ronent
"""

from configs import *
import numpy as np
import jsonpickle
from configs import defaults as default_param_dict

def complete_dict(d, default_d):
    new_d = {}
    for k,default_v in default_d.items():
        if k in d:
            new_d[k] = d[k]
        else:
            new_d[k] = default_d[k]
    return new_d


class NetworkConfiguration(object):
    def __init__(self, param_dict):
        param_dict = complete_dict(param_dict, default_param_dict)
        if param_dict[KEY_NET_TYPE] == 'simple':
            self.num_nodes = param_dict[KEY_NM_FACTOR] * param_dict[KEY_M]
            self.num_regions = param_dict[KEY_NUM_REGIONS]
            self.etx_size_bytes = param_dict[KEY_ETX_SIZE]
            self.num_etx_per_block = param_dict[KEY_NUM_ETX_BLOCK]
            self.bandwidth_bits_sec = param_dict[KEY_NODE_BW]
            self.msg_size_bytes = param_dict[KEY_MSG_SIZE]
            self.etx_share_bytes = param_dict[KEY_SHARE_SIZE]
            # TODO need to fix this to allow for general config of node regions
            self.node_bandwidths = self.num_nodes * [param_dict[KEY_NODE_BW]]
            self.node_regions = self.num_nodes * [0]
            self.c_mat = [[{"min_delay_ms": param_dict[KEY_NET_MIN_DELAY], "max_delay_ms":param_dict[KEY_NET_MAX_DELAY]} for i in range(self.num_regions)] for j in range(self.num_regions)]
        else:
            raise ValueError('Unsupported network type: %s' % (param_dict[KEY_NET_TYPE]))
        
class ExperimentConfiguration(object):
    def __init__(self, param_dict):
        param_dict = complete_dict(param_dict,default_param_dict)
        self.n = param_dict[KEY_NM_FACTOR] * param_dict[KEY_M]
        self.m = param_dict[KEY_M]
        if param_dict[KEY_BYZ_SETTING] == 'max':
            f = int(np.floor((self.m - 1) / 3))
        elif param_dict[KEY_BYZ_SETTING] == 'none':
            f = 0
        elif param_dict[KEY_BYZ_SETTING] == 'single':
            f = min([1,int(np.floor((self.m - 1) / 3))])
        else:
            raise ValueError('Unsupported byzantine setting type: %s' % (param_dict[KEY_BYZ_SETTING]))
        self.f = f
        self.k = (f + 1) * param_dict[KEY_KF_FACTOR]
        self.p_time_limit = param_dict[KEY_PROPOSAL_TIME_LIMIT]
        self.faulty_name = param_dict[KEY_FAULTY_NODE_NAME]
        self.net_config = NetworkConfiguration(param_dict)

class ScenarioConfig(object):
    def __init__(self, param_dict):
        param_dict = complete_dict(param_dict,default_param_dict)
        self.name = param_dict[KEY_SCEN_NAME]
        self.random_seed = param_dict[KEY_RANDOM_SEED]
        self.algorithm_name = param_dict[KEY_ALG_NAME]
        self.exp_config = ExperimentConfiguration(param_dict)
    def __str__(self):
        return jsonpickle.encode(self)
    def __repr__(self):
        return self.__str__()
        
        
    
if __name__ == "__main__":
    nc = NetworkConfiguration(10)
    ec = ExperimentConfiguration("test", 10, 7, 1, 3, 10000, "HonestNode", nc)
    sc = ScenarioConfig("testScenario", "seed", "oa-pbft", ec)
    pickled = jsonpickle.encode(sc)
    print(pickled)
        
   #      