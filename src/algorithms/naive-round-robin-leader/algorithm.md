# Naive Round Robin Leader

* We assume the number and identity of participating nodes is known and does not change
* Blocks are closed one after the other serially (each block has a block number)
* A block is closed every constant time (ie 1 second)
* The leader for each block is determined by its block number (modulo num nodes)
* The leader advertises the block to all validators and asks for validations
* Every validator responds with their validation
* The leader takes all validations that arrived within the block time and closes the block with them
* This means a closed block should be advertised by the leader every constant time (ie 1 second)
* If a closed block does not have enough validations (ie 4/6) the leader can cancel the block

### What happens if the leader fails to close the next block?

* Validators will allow a constant grace period for the next block to be closed (ie 2 seconds)
* If grace period passes any validator may propose to cancel this block
* Other validators that agree that the grace passed respond with their validations
* When enough validations are collected (ie 4/6) all nodes can move to the next block
