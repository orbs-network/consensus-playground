#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Created on Thu Mar 29 11:00:36 2018

@author: ronent
"""

import os
import re
import numpy as np
import itertools
from configs import *
import json
from pathlib import Path
from scenario_configuration import ScenarioConfig
from subprocess import PIPE,Popen


exp_file = Path("exp_configs.json")
results_re = re.compile(('%s(.*)' % (results_marker)))


def parse_results(raw_output):
    results = results_re.findall(raw_output)[0]
    return json.loads(results)
    

def run_simulation(scen_config, save_output=False):
    cmd = ' '.join(['node', simulator_script, "'%s'" % (str(scen_config))])
    if save_output:
        cmd.append('v')
    with Popen(cmd, stdout=PIPE, shell=True, cwd=str(root)) as proc:
        result = proc.stdout.read().decode("utf-8")
    return parse_results(result)

def load_exp_file(exp_filepath):
    with exp_filepath.open() as f:
        exp_configs = json.load(f)
        param_names = list(exp_configs.keys())
    return param_names, (itertools.product(*list(exp_configs.values())))
        
if __name__ == "__main__":
    keys,configs = load_exp_file(exp_file)
    all_configs = [c for c in configs]
    
    for i,config in enumerate(all_configs[:2]):
        param_dict = (dict(zip(keys,config)))
        scen_config = ScenarioConfig(param_dict)
        try:
            result = run_simulation(scen_config)
            print(result)
        except Exception as e:
            print('Error with run %d: %s' % (i, str(e)))
       
        