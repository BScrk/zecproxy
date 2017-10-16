var config = require('../config.json')
var net  = require('net');
var util = require('util');
//var ldj  = require('ldjson-stream');
var ldj  = require('ndjson');
const chalk = require('chalk');

var logger = require('./stratum_logger.js');
var info = require('../package.json');


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
var MinersController = function(poolproxy) {
    this.miners = new Map();
    this.proxy = poolproxy;
    this.id = 10;
    logger.dbg('[INFO] Workers controller created');
    this.listener = net.createServer( (newConnection) => {
        var miner = new Miner(newConnection,this); // create new miner
        this.miners.set(this.id, miner); // add it
        logger.dbg('[INFO] Active miners : '+ this.miners.size);
    }).listen(config.port);
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
MinersController.prototype.broadcastToMiners = function (obj) {
    this.miners.forEach(function(value,key) {
        value.send(obj);
    });
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
MinersController.prototype.sendToMiner = function (peer_id,obj) {
    logger.dbg('[MINER<'+peer_id+'>:SEND] ',obj);
    if(this.miners.get(peer_id)){
        this.miners.get(peer_id).send(obj);
    }else{
        logger.dbg('[MINER<'+peer_id+'>] OffLine');
    }
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
MinersController.prototype.removeMiner = function (peer_id) {
    this.miners.delete(peer_id);
    logger.dbg('[MINERS] ALIVE PEERS :');
    this.miners.forEach(function(value,key) {
        logger.dbg('[MINER<'+key+'>]');
    });
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
MinersController.prototype.destroy = function (obj) {
    this.listener.close();
    this.reset();
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
MinersController.prototype.reset = function (obj) {
    this.miners.forEach( (miner,peer_id) => {
        miner.connection.end();
        this.miners.delete(peer_id);
    });
}

// ----------------------------------------------------------------------------
var Miner = function(connection,controller){
    logger.dbg('[MINER:NEW_MINER]');
    this.id = ++controller.id;
    this.ctrl = controller;
    this.name = 'noname';
    this.connection = connection;
    this.status = "none";
    this.reqid = 0;
    this.connection.on('error', (err)=>{this.onError(err);});
    this.connection.on('data', (data)=>{})
        .pipe(ldj.parse({strict: true}))
          .on('data',(data)=>{ this.onData(data); })
          .on('error',(e)=>{ logger.err("invalid worker request, "+e); });
    this.connection.on('end',()=>{this.onEnd();});
}

// ----------------------------------------------------------------------------
// BASIC Socket functions
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
Miner.prototype.onError = function(error) {
    logger.dbg('[MINER<'+this.id+'>:ERROR] ',error);
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
Miner.prototype.onData = function(obj) {
    logger.dbg('[MINER<'+this.id+'>:IN] ' + JSON.stringify(obj));
    this.lastReqId = obj.id;
    if(obj.method == "mining.subscribe"){
        if(this.ctrl.proxy.sessionId == null){
            this.Error("No pool session id");
        }else{
            this.send({id:this.lastReqId,result:[this.ctrl.proxy.sessionId,this.ctrl.proxy.sessionId],error:null});
        }
    }else if(obj.method == "mining.authorize"){
        logger.log ( "New peer connected : " + chalk.blueBright(obj.params[0]));
        this.name = obj.params[0];
        if(this.ctrl.proxy.status != "ready"){
            this.Error("Proxy not authorised yet");
        }else{

            logger.log ( this.ctrl.miners.size + " peer(s) mining on this proxy");
            this.send({id:this.lastReqId,result:true,error:null});
            this.send({id:null,method:"mining.set_target", params:this.ctrl.proxy.last_target});
            this.send({id:null,method:"mining.notify", params:this.ctrl.proxy.last_notif});
        }
    } else if(obj.method == "mining.submit"){
        this.status = "submit";
        obj.params[0] = config.wallet;
        if(config.enable_worker_id){
            obj.params[0] = obj.params[0] + "." + this.name;
        }
        logger.log ( "Submit work for " + this.name);
        this.ctrl.proxy.submit(this.id,obj);
    }
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
Miner.prototype.Error = function(msg) {
    logger.err("Miner failure on state " + this.status, msg);
    this.send({id:this.lastReqId,error:msg} );
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
Miner.prototype.onEnd = function() {
    logger.warn ( "peer " + chalk.blueBright(this.name) + " disconnected");
    logger.dbg('[MINER<'+this.id+'>:DISCONNECTED] ');
    this.ctrl.removeMiner(this.id);
    logger.log ( this.ctrl.miners.size + " peer(s) mining on this proxy");
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
Miner.prototype.send = function(data) {
    logger.dbg('[MINER<'+this.id+'>:OUT] ',data);
    if (data.method && data.method == 'mining.notify' ) {
        // New work notification
        logger.dbg('[MINER<'+this.id+'>] Notify ' + this.name + ' for new work');
    } else if (this.status == "subscribe") {
        // Worker subscription
        data.id = this.lastReqId;
        logger.dbg('[MINER<'+this.id+'>] Subscribe result',data);
    } else if (this.status == "authorize") {
        // Worker subscription
        data.id = this.lastReqId;
        logger.dbg('[MINER<'+this.id+'>] Authorize result',data);
    } else if (this.status == "submit") {
        // Work submition
        data.id = this.lastReqId;
        logger.dbg('[MINER<'+this.id+'>] Submit result',data);
        if (data.result) {
            logger.log("Work from " + this.name + " " + chalk.green("accepted"));
        } else if (data.method && data.method === 'mining.set_target') {
            // method is returned from some pools and not others
            logger.log("Setting target for " + this.name + " " + chalk.blue(data.params[0]));
        } else if (data.error && data.error.length > 1) {
            // error is returned from some pools and not others
            logger.log("Work from " + this.name + " " + chalk.red("rejected: " + data.error[1]));
        } else {
            logger.log("Work from " + this.name + " " + chalk.red("rejected"));
        }
    }
    if (this.connection && !(this.connection.destroyed)) {
        this.connection.write(JSON.stringify(data) + '\n');
    } else {
        logger.err(this.name + " offline... removing from pool");
        this.ctrl.removeMiner(this.id);
    }
}

logger.warn("Zcash Stratul proxy version "+ info.version);
logger.warn("PROXY IS LISTENING ON PORT " + config.port);
logger.warn("-----------------------------------------------------------------------")
logger.warn("Mining Wallet: " + config.wallet)
logger.warn("Worker ID enabled: " + config.enable_worker_id)
logger.warn("Failover enabled: " + config.pool_failover_enabled)
logger.warn("-----------------------------------------------------------------------")
logger.warn("Donation ETH : 0x1212eF39d945aB9A9568Aa5a72c5CBA99Bbe46c1")
logger.warn("Donation ZEC : t1YAdYcnKR2ozADWPUvmgnDgf86gfsxQEEE")
logger.warn("-----------------------------------------------------------------------")

// ----------------------------------------------------------------------------
module.exports = {
    MinersController
};
