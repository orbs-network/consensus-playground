# Naive Fast Round Robin Leader

* We assume the number and identity of participating nodes is known and does not change
* Blocks are closed one after the other serially (each block has a block number)
* The leader for each block is determined by its block number (modulo num nodes)
* The leader advertises the block to all validators and asks for validations, the leader may now disappear
* Every validator responds with a broadcast of their validation
* When enough validations are collected (ie 4/6) all nodes can move to the next block

### What happens if the leader fails to close the next block?

* Validators will allow a constant grace period for the next block to be closed (ie 1 second)
* If grace period passes any validator may propose to cancel this block
* Other validators that agree that the grace passed respond with their validations
* When enough validations are collected (ie 4/6) all nodes can move to the next block
