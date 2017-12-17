# Sleeping Multi Paxos

* Standard multi paxos algorithm, described for example [here](https://www.youtube.com/watch?v=JEpsBg0AO6o)
* We assume all nodes behave according to protocol and are not byzantine
* To reduce the amount of collisions, every node sleeps a random amount before starting a new round
