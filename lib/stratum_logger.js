var config = require('../config.json')
var date = require('date-and-time');
const chalk = require('chalk');

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
var log = function (args) {
  var now = new Date();
  console.log(date.format(now, 'YYYY/MM/DD HH:mm:ss')+chalk.cyan(' INFO') + " # " + args);
} // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

var warn = function (args) {
  var now = new Date();
  console.log(date.format(now, 'YYYY/MM/DD HH:mm:ss')+chalk.yellow(' WARN') + " # " +args);
} 

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
var err = function (args) {
  var now = new Date();
  console.log(date.format(now, 'YYYY/MM/DD HH:mm:ss')+chalk.red(' ERROR') + " # " +args);
} 

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
var dbg = function () {
  if(config.debug){
    return Function.prototype.bind.call(console.log, console);
  }
  return ()=>{};
} ();

// ----------------------------------------------------------------------------
module.exports = {
  log,
  dbg,
  warn,
  err
};
