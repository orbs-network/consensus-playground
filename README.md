# Consensus Playground

A playground to simulate and experiment with various flavors of consensus algorithms. This is a private version containing work on the Orbs Consensus Algorithm, which will be made public after the white paper release.

## Install

* Make sure you have Node 8+ installed with NPM 5+
* For Python use, run `pip install -r requirements.txt` (best to install [Anaconda](https://www.anaconda.com/download/) for Python 3+ first)
* Run `./build.sh`

## Run Specific Scenario

* Run `node dist <scneario> [random-seed]`
* Example: `node dist naive-fast-round-robin-leader/happy-flow`
* Usage and list all scenarios: `node dist`

## Run Full Benchmark

* Run `node dist benchmark`

## Run Benchmark on Orbs Algorithm

* Run `node dist oa-benchmark`,  use `node dist oa-benchmark v` to output a unique file for each run (to save results and not overwrite them). Results will be written to `simulations/oa-benchmark-output/benchmark.html` if `v` flag not specified, and to a unique file indexed by current time, if `v` specified.

## Run Python Benchmark
* This allows you to utilize multi-processing and run a set of experiments controlled through a single configuration file.
* Usage:
  - Run `cd simulations`
  - Run `python run_simulations.py`
  - Simulations will be run on all parameters specified in the file [exp_configs.json](https://github.com/orbs-network/private-consensus-playground/blob/master/simulations/exp_configs.json), with results saved in the experiment folder generated according to the experiment name (`exp_name` field) specified in `exp_configs.json`.

## Run Visualization

* Run `node dist visualize <interval-ms> <scenario> [random-seed]`
* Example: `node dist visualize 50 sleeping-multi-paxos/happy-flow`
* [This is what it looks like](http://htmlpreview.github.io/?https://github.com/orbs-network/consensus-playground/blob/master/example.html)

## Develop

* Run `./watch.sh` to watch the sources for changes and rebuild automatically
* For a manual rebuild run `./rebuild.sh`
