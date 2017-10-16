var config = require('../config.json')
var net = require('net');
var tls = require('tls');
//var ldj = require('ldjson-stream');
var ldj  = require('ndjson');
const chalk = require('chalk');

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
    this.current_pool = null;

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    this.onConnect = function(connect){
        logger.log("Connected to pool "+ this.current_pool.host + ":" + this.current_pool.port);
        if(this.miners){// Reset workers connections
            logger.warn('Resetting workers...');
            this.miners.reset();
        }else{
            this.miners = new  minersController.MinersController(this);
        }
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
        if(error.code == 'ECONNRESET'){ // connection lost, retry on same pool
            this.connect(false);
        }else{ // Try with next pool
            this.connect(true);
        }
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
                logger.log('Stratum session id ' + this.sessionId);
                var auth = { id: 2
                           , method: "mining.authorize"
                           , params: [ config.wallet + "." + config.proxy_name
                                     , config.password ]
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
                logger.log('Mining wallet ' + config.wallet + chalk.green(' authorization granted') );
                var xtra = { id: 3
                           , method: "mining.extranonce.subscribe"
                           , params:[]
                }
                this.send(xtra);
            } else {
                logger.log('Mining wallet ' + config.wallet + chalk.red(' authorization failed') );
            }
        } else {
             if (obj.method === 'mining.notify' || obj.method === 'mining.set_target') {
                // Broadcast to all miners
                this.miners.broadcastToMiners(obj);
                if (obj.method === 'mining.notify') {
                    logger.log('New work : ' + obj.params[3]);
                    this.last_notif = obj.params;
                } else if (obj.method === 'mining.set_target') {
                    this.last_target = obj.params;
                    logger.log('New target : ' + obj.params[0]);
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
        logger.dbg('[POOL:OUT] send ' + obj.method + ': ' + JSON.stringify(obj));
        this.poolSocket.write(JSON.stringify(obj) + '\n');
    }
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    this.submit = function(minerId,obj){
        obj.id = minerId;
        logger.dbg('[POOL:OUT] submit ' + obj.method + ': ' + JSON.stringify(obj));
        this.poolSocket.write(JSON.stringify(obj) + '\n');
    }
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    this.error = function(msg) {
        logger.err("Proxy failure on state " + this.status + ' ' + msg);
        this.poolSocket.end();
    }


    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    this.connect = function(try_next_pool){
        if(this.poollist.length > 0 ){
            // Create connection with pool
            if(try_next_pool){
                this.current_pool = this.poollist.shift();
            }
            if(this.poolSocket){
                this.poolSocket.end();
                delete this.poolSocket;
                this.poolSocket = null;
            }
            this.status = "offline";
            logger.log(chalk.bold('Connecting to ' + this.current_pool.host +":"+this.current_pool.port) );
            if(this.current_pool.ssl){
                this.poolSocket = tls.connect(this.current_pool.port, this.current_pool.host, () => {
                    if (this.poolSocket.authorized) {
                      // authorization successful
                      logger.log( chalk.bold('SSL') + ' authorization ' + chalk.green('successful') + '...');
                    } else {
                       // authorization failed
                       logger.log( chalk.bold('SSL') + ' authorization ' + chalk.red('failed') + '...');
                       this.onError('SSL authorization failed for ' + this.current_pool.host + ':' + this.current_pool.port);
                    }
                 });
            }else{
                this.poolSocket = net.createConnection({
                    port: this.current_pool.port,
                    host: this.current_pool.host
                });
            }

            this.poolSocket.on('connect', (connect)=>{this.onConnect(connect);});
            this.poolSocket.on('error', (err)=>{this.onError(err);});
            this.poolSocket.on('data', (data)=>{})
                .pipe(ldj.parse({strict: true}))
                .on('data',(data)=>{ this.onData(data); })
                .on('error',(e)=>{ logger.err("invalid pool request, "+e); });
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

    // - - - START - - - //
    this.poollist.push( config.pool );
    if(config.pool_failover_enabled){
        this.poollist =  this.poollist.concat( config.pool_failover );
    }
    this.connect(true);
}

// ----------------------------------------------------------------------------
PoolConnector.prototype.destroy = function(){
    if(this.poolSocket){
        this.poolSocket.end();
        delete this.poolSocket;
        this.poolSocket = null;
    }
    if(this.miners){
        this.miners.destroy();
        delete this.miners;
        this.miners = null;
    }
};

// ----------------------------------------------------------------------------
module.exports = {
    PoolConnector
};
