# Naive Constant Leader

* Node 1 is always the leader
* Blocks are closed one after the other serially (each block has a block number)
* A block is closed every constant time (ie 1 second)
* The leader advertises the block to all validators and asks for validations
* Every validator responds with their validation
* The leader takes all validations that arrived within the block time and closes the block with them
* This means a closed block is advertised by the leader every constant time (ie 1 second)
* A closed block may have a variable number of validations, or even zero
* The protocol will instruct nodes to disregard closed blocks that don't have enough validations
