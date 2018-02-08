# Orbs Consensus Algorithm
Version one of the event-based simulator for the Orbs Consensus algorithm.

## Assumptions
 * Simple faults - sleepy/crashing nodes.
 * No mempool - no simulation of individual transactions, we represent block content by a single random number in the block, and we assume we always have unlimited transactions.
* No reputation system
* No changes in federation members
* Ignoring data size and block content length
* Abstracting away cryptography: encryption, decryption, signatures, etc.
* Abstracting away network layer - gossiping protocols for block, share, tx propagation.

## To be added to v1:
* Syncing scheme - Until this is added, nodes that fall out of sync currently only have a limited capacity to return.
* Finish message validation implementations
> Written with [StackEdit](https://stackedit.io/).
