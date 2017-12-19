# Consensus Playground

A playground to simulate and experiment with various flavors of consensus algorithms.

## Install

* Make sure you have Node 8+ installed with NPM 5+
* Run `./build.sh`

## Run specific scenario

* Run `node dist <scneario> [random-seed]`
* Example: `node dist naive-fast-round-robin-leader/happy-flow`
* Usage and list all scenarios: `node dist`

## Run full benchmark

* Run `node dist benchmark`

## Develop

* Run `./watch.sh` to watch the sources for changes and rebuild automatically
* For a manual rebuild run `./rebuild.sh`
