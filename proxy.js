
var remotePool = require('./lib/pool_connector.js');
var logger = require('./lib/stratum_logger.js');
var poolProxy = null;



var startStratum = function() {
    logger.log("ZEC STRATUM PROXY STARTING...");        
    poolProxy = new remotePool.PoolConnector(restartStratum);
}

var restartStratum = function() {
    logger.warn("ZEC STRATUM PROXY RESTARTING...");
    poolProxy.destroy();
    delete poolProxy;
    startStratum();
}
    

startStratum();