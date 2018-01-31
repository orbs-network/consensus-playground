# Orbs Consensus Algorithm
Version one of the event-based simulator for the Orbs Consensus algorithm.

## Assumptions
 * No Byzantine nodes (yet) - all nodes behave according to protocol.
 * No mempool - no simulation of individual transactions, we represent block content by a single random number in the block, and we assume we always have unlimited transactions.
* No reputation system
* No changes in federation members
* Ignoring data size and block content length
* Abstracting away cryptography: encryption, decryption, signatures, etc.
* Abstracting away network layer - gossiping protocols for block, share, tx propagation.

## To be added to v1:
* Timeouts and view change in PBFT
* Sharing scheme
* Syncing scheme

> Written with [StackEdit](https://stackedit.io/).
