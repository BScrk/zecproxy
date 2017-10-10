var config = require('../config.json')
var net = require('net');
var ldj = require('ldjson-stream');

var logger = require('./stratum_logger.js');
var minersController = require('./miners_controller.js');

// ----------------------------------------------------------------------------
var PoolConnector = function(restartCallback){

    this.status = "offline";
    this.miners = null;
    this.sessionId = null;

    this.last_target = null;
    this.last_notif = null;
    this.poollist = [];

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    this.onConnect = function(connect){
        logger.log("CONNECTED TO POOL "+ config.pool.host + ":" + config.pool.port);
        this.miners = new  minersController.MinersController(this);
        // Subscribe to pool
        logger.log('Subscribing to pool...');
        var sub = { id: 1
                  , method:"mining.subscribe"
                  , params: [ "","", "Stratum proxy" ]};
        this.status = "subscribing";
        this.send(sub);
    };
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    this.onError = function(error) {
        logger.err('Network error, ' + error);
        this.connect();
    };
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    this.onData = function(obj) {
        logger.dbg('====================================')
        logger.dbg('[POOL:IN] ' + JSON.stringify(obj));
        if (this.status == 'subscribing' && (obj.id == 1)) { // Subscription (internal)
            if(obj.error){
                this.error(obj.error);
            }else{
                this.sessionId = obj.result[1];
                logger.log('Stratum session id : ' + this.sessionId);
                var auth = {
                    id: 2,
                    method: "mining.authorize",
                    params: [
                        config.wallet + "."+config.proxy_name,"x"
                    ]
                };
                logger.log('Authorizing mining wallet '+ config.wallet);
                this.status = "authorizing";
                this.send(auth);
            }
        } else if (this.status == 'authorizing' &&  (obj.id == 2)) {  // Authorization (internal)
            if (obj.error) {
                this.error(obj.error);
            } else if (obj.result) {
                this.status = 'ready';
                logger.log(config.wallet + ' Authorized');
                var xtra = {
                    id: 3,
                    method: "mining.extranonce.subscribe",
                    params:[]
                }
                this.send(xtra);
            } else {
                this.error('Failed to authorize: ' + config.wallet);
            }
        } else {
             if (obj.method === 'mining.notify' || obj.method === 'mining.set_target') {
                // Broadcast to all miners
                this.miners.broadcastToMiners(obj);
                if (obj.method === 'mining.notify') {
                    logger.log('New work : ' + obj.params[0]);
                    this.last_notif = obj.params;
                } else if (obj.method === 'mining.set_target') {
                    this.last_target = obj.params;
                }
            } else { //Forward message to the correct miner
                this.miners.sendToMiner(obj.id, obj);
            }
        }
        logger.dbg('====================================')
    };
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    this.onEnd = function() {
        logger.log('Pool closed the connection...');
        this.reconnect();
    };
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    this.send = function(obj){
        logger.dbg('[POOL:OUT] ' + obj.method + ': ' + JSON.stringify(obj));
        this.poolSocket.write(JSON.stringify(obj) + '\n');
    }
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    this.submit = function(minerId,obj){
        obj.id = minerId;
        logger.dbg('[POOL:OUT] ' + obj.method + ': ' + JSON.stringify(obj));
        this.poolSocket.write(JSON.stringify(obj) + '\n');
    }
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    this.error = function(msg) {
        logger.err("Proxy failure on state " + this.status + ' ' + msg);
        this.poolSocket.end();
    }


    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    this.poollist.push( config.pool );
    if(config.pool_failover_enabled){
        this.poollist =  this.poollist.concat( config.pool_failover );
    }

    this.connect = function(){
        if(this.poollist.length > 0 ){
            // Create connection with pool
            var pool = this.poollist.shift();
            logger.log('Connecting to ' + pool.host +":"+pool.port );

            this.poolSocket = net.createConnection({
                port: pool.port,
                host: pool.host
            });
            this.poolSocket.on('connect', (connect)=>{this.onConnect(connect);});
            this.poolSocket.on('error', (err)=>{this.onError(err);});
            this.poolSocket.on('data', (data)=>{})
                .pipe(ldj.parse()).on('data',(data)=>{
                    this.onData(data);
                });
            this.poolSocket.on('end',()=>{this.onEnd();});
        }else{
            logger.err('All connections failed...');
            this.reconnect();
        }
    }

    this.reconnect = function () {
        logger.err("Waiting 10 seconds before attempting to restart the Stratum Proxy");
        setTimeout( () => { restartCallback(); },10000);
    }

    this.connect();
}

// ----------------------------------------------------------------------------
PoolConnector.prototype.destroy = function(){
    if(this.poolSocket){
        this.poolSocket.end();
        delete this.poolSocket;
    }
    if(this.miners){
        this.miners.destroy();
        delete this.miners;
    }
};

// ----------------------------------------------------------------------------
module.exports = {
    PoolConnector
};
