![alt text](https://buyingzcash.com/images/logo.png)

# Description 
This is a Stratum Proxy for Zcash using JSON-RPC.

Originally developed by the [Cryptense](http://www.cryptense.com) team.

Working with [Dwarfpool](http://dwarfpool.com/zec) and [Nanopool](http://zec.nanopool.org).
Also tried on [Miningspeed](https://pool.miningspeed.com/) on Zclassic / BitcoinZ / ZenCash coins. 
Some issues with [flypool](http://zcash.flypool.org/), better not use with this pool.

Successfully tested with [EWBF's Zcash CUDA miner. 0.3.4b](https://bitcointalk.org/index.php?topic=1707546.0) and [dstm's ZCash Nvidia Miner v0.5 (Linux)](https://bitcointalk.org/index.php?topic=2021765.0) with several GPUs Rigs.

![alt text](http://g.recordit.co/8oX3Pj77BN.gif)


**WARNING** This work is still in development. Please report any broken features or issues.


# Features
* Additional up to 10-20% increase of earning compared to standard pools
* Zcash stratum proxy
* Pool failover system
* Only one connection to the pool
* Workers get new jobs immediately
* Submit of shares without network delay, it's like solo-mining but with benefits of professional pool
* Central Wallet configuration, miners doesn't need wallet as username
* Bypasse worker_id for detailed statistic and per rig monitoring - not supported on flypool yet / working on nanopool
* PM2 support
* SSL / TCP protocols support


# How it Works
```
  Pool A < ---+                         +------------- > Rig 1 / Worker 1
 (Active)     |                         |
              |                         +------------- > Rig 2 / Worker 2
              |                         |
  Pool B < ---+--- > StratumProxy < ----+------------- > Rig 3 / Worker 3
(FailOver)                              |
                                        +------------- > Rig 4 / Worker 4       
```


# Todo
* Logfile setup
* ASCII UI
* Watchdog system (alive / gpu failure) 
* Hashrate computation


# Installation and Start
* `git clone https://github.com/BScrk/zecproxy.git`
* `cd zec_stratum`
* `npm install`
* `npm start`

The proxy will automatically listen on port 8000 for miners.


# Configuration
* all configs in file config.json to change settings. 
```
{
  "wallet": "<Your wallet>",
  "password" : "<Pool password or just 'x'>",
  "port": <Proxy port>,
  "proxy_name" : "<Proxy default name>" (shown on the pool if enable_worker_id set to false),
  "enable_worker_id": true|false (send worker name to the pool or not), 
  "pool" : { "host" : "<HOST>"  , "port" : <PORT>, "ssl" : true|false },
  "pool_failover_enabled": true|false,
  "pool_failover" : [  { "host" : "<HOST>"  , "port" : <PORT>, "ssl" : true|false },
                       { "host" : "<HOST>"  , "port" : <PORT>, "ssl" : true|false },
                       { "host" : "<HOST>"  , "port" : <PORT>, "ssl" : true|false }],
  "restart_delay": <delay before restarting the proxy on error>,
  "on_rejected_share": {
                      "strategy" : "<On Rejected Share strategy>" (continue / kill / restart),
                      "threshold" : <number of rejected shares before applying strategy>
                    },
  "debug" : true|false
}
```
### On Rejected Share strategies :
* `continue` : ignore and continue
* `restart` : Restart the proxy (without pm2)
* `kill` : Kill the process (hard restart using pm2)

# Miners command line 

## EWBF's Zcash CUDA miner

./miner --server <PROXY_ADDRSS> --user <RIG_NAME> --pass <PASS> --port <PROXY_PORT>

exemple : `./miner --server 192.168.0.10 --user miner_1 --pass "x" --port 8000 --solver 0`

## dstm's ZCASH Cuda Miner

./miner --server <PROXY_ADDRSS> --user <RIG_NAME> --pass <PASS> --port <PROXY_PORT>   

exemple : `./miner --server $192.168.0.10 --port 8000 --user miner_1 --pass "x"`


# Docker
The project is now dockerized for more convenience :)

## Official container ...
Find the official image on the Docker Hub [bscrk/zecproxy](https://hub.docker.com/r/bscrk/zecproxy/) :

* `docker pull bscrk/zecproxy`
* `git clone https://github.com/BScrk/zecproxy.git`
* `cd zec_stratum`
* edit config file
* `docker run -d --name=zecproxy -p 8000:8000 -v $(pwd)/config.json:/usr/src/app/config.json bscrk/zecproxy:latest`


## ... or make your own
Setup and make your own image :
* `git clone https://github.com/BScrk/zecproxy.git`
* `cd zec_stratum`
* edit config file
* `docker build . -t zecproxy`
* `docker run -p 8000:8000 -d zecproxy`


# Donations
* ETH:  0x1212eF39d945aB9A9568Aa5a72c5CBA99Bbe46c1
* ZEC:  t1YAdYcnKR2ozADWPUvmgnDgf86gfsxQEEE


# Requirements
zec_stratum is build with nodeJS. The requirements for running zec_stratum are:

* linux (recommend)
* nodeJS
* npm


# Contact
* We are available via dev@cryptense.com


# License
This software is provides AS-IS without any warranties of any kind.
**Please use at your own risk.**


# Protocol Documentation
* https://slushpool.com/help/manual/stratum-protocol
* https://github.com/ctubio/php-proxy-stratum/wiki/Stratum-Mining-Protocol
* https://github.com/slushpool/poclbm-zcash/wiki/Stratum-protocol-changes-for-ZCash
