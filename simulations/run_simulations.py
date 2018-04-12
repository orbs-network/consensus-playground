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
from toolz import partition_all
from joblib import Parallel, delayed
import pandas as pd
import tqdm
#import multiprocessing as mp


exp_file = Path("exp_configs.json")
results_re = re.compile(('%s(.*)' % (results_marker)))


def parse_results(raw_output):
    results = results_re.findall(raw_output)[0]
    return json.loads(results)

def run_batch(i, batch):
    batch_results = []
    for config in batch:
        results = run_simulation(config) 
        batch_results.append(results)
    df = pd.DataFrame(batch_results)
    df.to_csv(str(exp_dir / config[KEY_SCEN_NAME] / ('batch_%d.csv' % (i))  ))
    
        

def run_simulation(param_dict, save_output=False):
    scen_config = ScenarioConfig(param_dict)
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
    num_jobs = os.cpu_count() - 2
    batch_size = 10 
    keys,param_configs = load_exp_file(exp_file)
    all_configs = [dict(zip(keys,config)) for config in param_configs]
    scen_name = all_configs[0][KEY_SCEN_NAME]
    out_dir = exp_dir / scen_name
    try:
        os.makedirs(out_dir)
    except:
        pass
    
    partitions = partition_all(batch_size, all_configs)
    executor = Parallel(n_jobs=num_jobs, verbose=100)
    do = delayed(run_batch)

    tasks = (do(i, batch)
             for i, batch in enumerate(partitions))
    executor(tasks)
    print('Batches complete. Collecting batch results...')
    dfs = []
    for i,batch_res_file in enumerate(tqdm.tqdm(out_dir.glob('*batch_[0-9]*.csv'))):
        batch_res_df = pd.read_csv(str(batch_res_file))
        dfs.append(batch_res_df)
        os.remove(batch_res_file)
    all_res = pd.concat(dfs)
    all_res.to_csv(str(out_dir / 'results.csv'))