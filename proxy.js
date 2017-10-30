
var remotePool = require('./lib/pool_connector.js');
var logger = require('./lib/stratum_logger.js');
var info = require('./package.json');

var poolProxy = null;



var startStratum = function() {
    logger.log("ZEC STRATUM PROXY "+ info.version +" STARTING...");        
    poolProxy = new remotePool.PoolConnector(restartStratum);
}

var restartStratum = function() {
    logger.warn("ZEC STRATUM PROXY RESETING...");
    poolProxy.destroy();
    delete poolProxy;
    startStratum();
}
    

startStratum();