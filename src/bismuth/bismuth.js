const canvg = require("canvg");
const stackBlur = require("./lib/StackBlur");
const RGBColor = require("./lib/rgbcolor");
const JSZip = require("jszip");

var P = (function() {
  'use strict';

  var SCALE = window.devicePixelRatio || 1;

  var hasTouchEvents = 'ontouchstart' in document;

  var AudioContext = window.AudioContext || window.webkitAudioContext;
  var audioContext = AudioContext && new AudioContext;
  window.audioContext = audioContext;

  var inherits = function(cla, sup) {
    cla.prototype = Object.create(sup.prototype);
    cla.parent = sup;
    cla.base = function(self, method /*, args... */) {
      return sup.prototype[method].call(self, [].slice.call(arguments, 2));
    };
  };

  var Events = require("./events");

  var addEvents = Events.addEvents;

  var addEvent = Events.addEvent;

  var IO = require('./io');

  var Base = require("./spritebase");

  var Stage = require("./stage");

  var KEY_CODES = {
    space: 32,
    'left arrow': 37,
    'up arrow': 38,
    'right arrow': 39,
    'down arrow': 40,
    any: 'any'
  };

  var getKeyCode = function(keyName) {
    return KEY_CODES[keyName.toLowerCase()] || keyName.toUpperCase().charCodeAt(0);
  };

  var Sprite = require("./sprite");

  var Costume = require("./costume");

  var Sound = require("./sound");

  var Watcher = require("./watcher");

  return {
    hasTouchEvents: hasTouchEvents,
    getKeyCode: getKeyCode,
    audioContext: audioContext,
    IO: IO,
    Base: Base,
    Stage: Stage,
    Sprite: Sprite,
    Watcher: Watcher
  };

}());

P.compile = require("./binds/compile")(P);

P.runtime = require("./binds/runtime")(P);

P.player = require("./binds/player")(P);

window.P = P;
export default P;