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

P.compile = (function() {
  'use strict';

  var LOG_PRIMITIVES;
  var DEBUG;
  // LOG_PRIMITIVES = true;
  // DEBUG = true;

  var EVENT_SELECTORS = [
    'procDef',
    'whenClicked',
    'whenCloned',
    'whenGreenFlag',
    'whenIReceive',
    'whenKeyPressed',
    'whenSceneStarts',
    'whenSensorGreaterThan' // TODO
  ];

  var compileScripts = function(object) {
    for (var i = 0; i < object.scripts.length; i++) {
      compileListener(object, object.scripts[i][2]);
    }
  };

  var warnings;
  var warn = function(message) {
    warnings[message] = (warnings[message] || 0) + 1;
  };

  var compileListener = function(object, script) {
    if (!script[0] || EVENT_SELECTORS.indexOf(script[0][0]) === -1) return;

    var nextLabel = function() {
      return object.fns.length + fns.length;
    };

    var label = function() {
      var id = nextLabel();
      fns.push(source.length);
      visual = 0;
      return id;
    };

    var delay = function() {
      source += 'return;\n';
      label();
    };

    var queue = function(id) {
      source += 'queue(' + id + ');\n';
      source += 'return;\n';
    };

    var forceQueue = function(id) {
      source += 'forceQueue(' + id + ');\n';
      source += 'return;\n';
    };

    var seq = function(script) {
      if (!script) return;
      for (var i = 0; i < script.length; i++) {
        compile(script[i]);
      }
    };

    var varRef = function(name) {
      if (typeof name !== 'string') {
        return 'getVars(' + val(name) + ')[' + val(name) + ']';
      }
      var o = object.stage.vars[name] !== undefined ? 'self' : 'S';
      return o + '.vars[' + val(name) + ']';
    };

    var listRef = function(name) {
      if (typeof name !== 'string') {
        return 'getLists(' + val(name) + ')[' + val(name) + ']';
      }
      var o = object.stage.lists[name] !== undefined ? 'self' : 'S';
      if (o === 'S' && !object.lists[name]) {
        object.lists[name] = [];
      }
      return o + '.lists[' + val(name) + ']';
    };

    var param = function(name, usenum, usebool) {
      if (typeof name !== 'string') {
        throw new Error('Dynamic parameters are not supported');
      }

      if (!inputs) return '0';

      var i = inputs.indexOf(name);
      if (i === -1) {
        return '0';
      }

      var t = types[i];
      var kind =
        t === '%n' || t === '%d' || t === '%c' ? 'num' :
        t === '%b' ? 'bool' : '';

      if (kind === 'num' && usenum) {
        used[i] = true;
        return 'C.numargs[' + i + ']';
      }
      if (kind === 'bool' && usebool) {
        used[i] = true;
        return 'C.boolargs[' + i + ']';
      }

      var v = 'C.args[' + i + ']';
      if (usenum) return '(+' + v + ' || 0)';
      if (usebool) return 'bool(' + v + ')';
      return v;
    };

    var val2 = function(e) {
      var v;
      if (e[0] === 'costumeName') {

        return 'S.getCostumeName()';

      } else if (e[0] === 'sceneName') {

        return 'self.getCostumeName()';

      } else if (e[0] === 'readVariable') {

        return varRef(e[1]);

      } else if (e[0] === 'contentsOfList:') {

        return 'contentsOfList(' + listRef(e[1]) + ')';

      } else if (e[0] === 'getLine:ofList:') {

        return 'getLineOfList(' + listRef(e[2]) + ', ' + val(e[1]) + ')';

      } else if (e[0] === 'concatenate:with:') {

        return '("" + ' + val(e[1]) + ' + ' + val(e[2]) + ')';

      } else if (e[0] === 'letter:of:') {

        return '(("" + ' + val(e[2]) + ')[(' + num(e[1]) + ' | 0) - 1] || "")';

      } else if (e[0] === 'answer') { /* Sensing */

        return 'self.answer';

      } else if (e[0] === 'getAttribute:of:') {

        return 'attribute(' + val(e[1]) + ', ' + val(e[2]) + ')';

      } else if (e[0] === 'getUserId') {

        return '0';

      } else if (e[0] === 'getUserName') {

        return '""';

      } else {

        warn('Undefined val: ' + e[0]);

      }
    };

    var val = function(e, usenum, usebool) {
      var v;

      if (typeof e === 'number' || typeof e === 'boolean') {

        return '' + e;

      } else if (typeof e === 'string') {

        return '"' + e
          .replace(/\\/g, '\\\\')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/"/g, '\\"')
          .replace(/\{/g, '\\x7b')
          .replace(/\}/g, '\\x7d') + '"';

      } else if (e[0] === 'getParam') {

        return param(e[1], usenum, usebool);

      } else if ((v = numval(e)) != null || (v = boolval(e)) != null) {

        return v;

      } else {

        v = val2(e);
        if (usenum) return '(+' + v + ' || 0)';
        if (usebool) return 'bool(' + v + ')';
        return v;

      }
    };

    var numval = function(e) {

      if (e[0] === 'xpos') { /* Motion */

        return 'S.scratchX';

      } else if (e[0] === 'ypos') {

        return 'S.scratchY';

      } else if (e[0] === 'heading') {

        return 'S.direction';

      } else if (e[0] === 'costumeIndex') { /* Looks */

        return '(S.currentCostumeIndex + 1)';

      } else if (e[0] === 'backgroundIndex') {

        return '(self.currentCostumeIndex + 1)';

      } else if (e[0] === 'scale') {

        return '(S.scale * 100)';

      } else if (e[0] === 'volume') { /* Sound */

        return '(S.volume * 100)';

      } else if (e[0] === 'tempo') {

        return 'self.tempoBPM';

      } else if (e[0] === 'lineCountOfList:') { /* Data */

        return listRef(e[1]) + '.length';

      } else if (e[0] === '+') { /* Operators */

        return '(' + num(e[1]) + ' + ' + num(e[2]) + ' || 0)';

      } else if (e[0] === '-') {

        return '(' + num(e[1]) + ' - ' + num(e[2]) + ' || 0)';

      } else if (e[0] === '*') {

        return '(' + num(e[1]) + ' * ' + num(e[2]) + ' || 0)';

      } else if (e[0] === '/') {

        return '(' + num(e[1]) + ' / ' + num(e[2]) + ' || 0)';

      } else if (e[0] === 'randomFrom:to:') {

        return 'random(' + num(e[1]) + ', ' + num(e[2]) + ')';

      } else if (e[0] === 'abs') {

        return 'Math.abs(' + num(e[1]) + ')';

      } else if (e[0] === 'sqrt') {

        return 'Math.sqrt(' + num(e[1]) + ')';

      } else if (e[0] === 'stringLength:') {

        return '("" + ' + val(e[1]) + ').length';

      } else if (e[0] === '%' || e[0] === '\\\\') {

        return 'mod(' + num(e[1]) + ', ' + num(e[2]) + ')';

      } else if (e[0] === 'rounded') {

        return 'Math.round(' + num(e[1]) + ')';

      } else if (e[0] === 'computeFunction:of:') {

        if (typeof e[1] !== 'object') {
          switch ('' + e[1]) {
            case 'abs':
              return 'Math.abs(' + num(e[2]) + ')';
            case 'floor':
              return 'Math.floor(' + num(e[2]) + ')';
            case 'sqrt':
              return 'Math.sqrt(' + num(e[2]) + ')';
            case 'ceiling':
              return 'Math.ceil(' + num(e[2]) + ')';
            case 'cos':
              return 'Math.cos(' + num(e[2]) + ' * Math.PI / 180)';
            case 'sin':
              return 'Math.sin(' + num(e[2]) + ' * Math.PI / 180)';
            case 'tan':
              return 'Math.tan(' + num(e[2]) + ' * Math.PI / 180)';
            case 'asin':
              return 'Math.asin(' + num(e[2]) + ') * 180 / Math.PI';
            case 'acos':
              return 'Math.acos(' + num(e[2]) + ') * 180 / Math.PI';
            case 'atan':
              return 'Math.atan(' + num(e[2]) + ') * 180 / Math.PI';
            case 'ln':
              return 'Math.log(' + num(e[2]) + ')';
            case 'log':
              return 'Math.log(' + num(e[2]) + ') / Math.LN10';
            case 'e ^':
              return 'Math.exp(' + num(e[2]) + ')';
            case '10 ^':
              return 'Math.exp(' + num(e[2]) + ' * Math.LN10)';
          }
          return '0';
        }
        return 'mathFunc(' + val(e[1]) + ', ' + num(e[2]) + ')';

      } else if (e[0] === 'mouseX') { /* Sensing */

        return 'self.mouseX';

      } else if (e[0] === 'mouseY') {

        return 'self.mouseY';

      } else if (e[0] === 'timer') {

        return '((self.now - self.timerStart) / 1000)';

      } else if (e[0] === 'distanceTo:') {

        return 'S.distanceTo(' + val(e[1]) + ')';

      // } else if (e[0] === 'soundLevel') {

      } else if (e[0] === 'timestamp') {

        return '((Date.now() - epoch) / 86400000)';

      } else if (e[0] === 'timeAndDate') {

        return 'timeAndDate(' + val(e[1]) + ')';

      // } else if (e[0] === 'sensor:') {

      }
    };

    var DIGIT = /\d/;
    var boolval = function(e) {

      if (e[0] === 'list:contains:') { /* Data */

        return 'listContains(' + listRef(e[1]) + ', ' + val(e[2]) + ')';

      } else if (e[0] === '<' || e[0] === '>') { /* Operators */

        if (typeof e[1] === 'string' && DIGIT.test(e[1]) || typeof e[1] === 'number') {
          var less = e[0] === '<';
          var x = e[1];
          var y = e[2];
        } else if (typeof e[2] === 'string' && DIGIT.test(e[2]) || typeof e[2] === 'number') {
          var less = e[0] === '>';
          var x = e[2];
          var y = e[1];
        }
        var nx = +x;
        if (x == null || nx !== nx) {
          return '(compare(' + val(e[1]) + ', ' + val(e[2]) + ') === ' + (e[0] === '<' ? -1 : 1) + ')';
        }
        return (less ? 'numLess' : 'numGreater') + '(' + nx + ', ' + val(y) + ')';

      } else if (e[0] === '=') {

        if (typeof e[1] === 'string' && DIGIT.test(e[1]) || typeof e[1] === 'number') {
          var x = e[1];
          var y = e[2];
        } else if (typeof e[2] === 'string' && DIGIT.test(e[2]) || typeof e[2] === 'number') {
          var x = e[2];
          var y = e[1];
        }
        var nx = +x;
        if (x == null || nx !== nx) {
          return '(equal(' + val(e[1]) + ', ' + val(e[2]) + '))';
        }
        return '(numEqual(' + nx + ', ' + val(y) + '))';

      } else if (e[0] === '&') {

        return '(' + bool(e[1]) + ' && ' + bool(e[2]) + ')';

      } else if (e[0] === '|') {

        return '(' + bool(e[1]) + ' || ' + bool(e[2]) + ')';

      } else if (e[0] === 'not') {

        return '!' + bool(e[1]) + '';

      } else if (e[0] === 'mousePressed') { /* Sensing */

        return 'self.mousePressed';

      } else if (e[0] === 'touching:') {

        return 'S.touching(' + val(e[1]) + ')';

      } else if (e[0] === 'touchingColor:') {

        return 'S.touchingColor(' + val(e[1]) + ')';

      // } else if (e[0] === 'color:sees:') {

      } else if (e[0] === 'keyPressed:') {

        var v = typeof e[1] === 'object' ?
          'P.getKeyCode(' + val(e[1]) + ')' : val(P.getKeyCode(e[1]));
        return '!!self.keys[' + v + ']';

      // } else if (e[0] === 'isLoud') {

      // } else if (e[0] === 'sensorPressed:') {

      }
    };

    var bool = function(e) {
      if (typeof e === 'boolean') {
        return e;
      }
      if (typeof e === 'number' || typeof e === 'string') {
        return +e !== 0 && e !== '' && e !== 'false' && e !== false;
      }
      var v = boolval(e);
      return v != null ? v : val(e, false, true);
    };

    var num = function(e) {
      if (typeof e === 'number') {
        return e || 0;
      }
      if (typeof e === 'boolean' || typeof e === 'string') {
        return +e || 0;
      }
      var v = numval(e);
      return v != null ? v : val(e, true);
    };

    var beatHead = function(dur) {
      source += 'save();\n';
      source += 'R.start = self.now;\n';
      source += 'R.duration = ' + num(dur) + ' * 60 / self.tempoBPM;\n';
      source += 'var first = true;\n';
    };

    var beatTail = function(dur) {
        var id = label();
        source += 'if (self.now - R.start < R.duration * 1000 || first) {\n';
        source += '  var first;\n';
        forceQueue(id);
        source += '}\n';

        source += 'restore();\n';
    };

    var wait = function(dur) {
      source += 'save();\n';
      source += 'R.start = self.now;\n';
      source += 'R.duration = ' + dur + ';\n';
      source += 'var first = true;\n';

      var id = label();
      source += 'if (self.now - R.start < R.duration * 1000 || first) {\n';
      source += '  var first;\n';
      forceQueue(id);
      source += '}\n';

      source += 'restore();\n';
    };

    var noRGB = '';
    noRGB += 'if (S.penCSS) {\n';
    noRGB += '  var hsl = rgb2hsl(S.penColor & 0xffffff);\n';
    noRGB += '  S.penHue = hsl[0];\n';
    noRGB += '  S.penSaturation = hsl[1];\n';
    noRGB += '  S.penLightness = hsl[2];\n';
    noRGB += '  S.penCSS = null;';
    noRGB += '}\n';

    var visual = 0;
    var compile = function(block) {
      if (LOG_PRIMITIVES) {
        source += 'console.log(' + val(block[0]) + ');\n';
      }

      if (['turnRight:', 'turnLeft:', 'heading:', 'pointTowards:', 'setRotationStyle', 'lookLike:', 'nextCostume', 'say:duration:elapsed:from:', 'say:', 'think:duration:elapsed:from:', 'think:', 'changeGraphicEffect:by:', 'setGraphicEffect:to:', 'filterReset', 'changeSizeBy:', 'setSizeTo:', 'comeToFront', 'goBackByLayers:'].indexOf(block[0]) !== -1) {
        if (visual < 2) {
          source += 'if (S.visible) VISUAL = true;\n';
          visual = 2;
        } else if (DEBUG) source += '/* visual: 2 */\n';
      } else if (['forward:', 'gotoX:y:', 'gotoSpriteOrMouse:', 'changeXposBy:', 'xpos:', 'changeYposBy:', 'ypos:', 'bounceOffEdge', 'glideSecs:toX:y:elapsed:from:'].indexOf(block[0]) !== -1) {
        if (visual < 1) {
          source += 'if (S.visible || S.isPenDown) VISUAL = true;\n';
          visual = 1;
        } else if (DEBUG) source += '/* visual: 1 */\n';
      } else if (['showBackground:', 'startScene', 'nextBackground', 'nextScene', 'startSceneAndWait', 'show', 'hide', 'putPenDown', 'stampCostume', 'showVariable:', 'hideVariable:', 'doAsk', 'setVolumeTo:', 'changeVolumeBy:', 'setTempoTo:', 'changeTempoBy:'].indexOf(block[0]) !== -1) {
        if (visual < 3) {
          source += 'VISUAL = true;\n';
          visual = 3;
        } else if (DEBUG) source += '/* visual: 3 */\n';
      }

      if (block[0] === 'forward:') { /* Motion */

        source += 'S.forward(' + num(block[1]) + ');\n';

      } else if (block[0] === 'turnRight:') {

        source += 'S.setDirection(S.direction + ' + num(block[1]) + ');\n';

      } else if (block[0] === 'turnLeft:') {

        source += 'S.setDirection(S.direction - ' + num(block[1]) + ');\n';

      } else if (block[0] === 'heading:') {

        source += 'S.setDirection(' + num(block[1]) + ');\n';

      } else if (block[0] === 'pointTowards:') {

        source += 'S.pointTowards(' + val(block[1]) + ');\n';

      } else if (block[0] === 'gotoX:y:') {

        source += 'S.moveTo(' + num(block[1]) + ', ' + num(block[2]) + ');\n';

      } else if (block[0] === 'gotoSpriteOrMouse:') {

        source += 'S.gotoObject(' + val(block[1]) + ');\n';

      } else if (block[0] === 'changeXposBy:') {

        source += 'S.moveTo(S.scratchX + ' + num(block[1]) + ', S.scratchY);\n';

      } else if (block[0] === 'xpos:') {

        source += 'S.moveTo(' + num(block[1]) + ', S.scratchY);\n';

      } else if (block[0] === 'changeYposBy:') {

        source += 'S.moveTo(S.scratchX, S.scratchY + ' + num(block[1]) + ');\n';

      } else if (block[0] === 'ypos:') {

        source += 'S.moveTo(S.scratchX, ' + num(block[1]) + ');\n';

      } else if (block[0] === 'bounceOffEdge') {

        source += 'S.bounceOffEdge();\n';

      } else if (block[0] === 'setRotationStyle') {

        source += 'var style = ' + val(block[1]) + ';\n';
        source += 'S.rotationStyle = style === "left-right" ? "leftRight" : style === "don\'t rotate" ? "none" : "normal";\n';

      } else if (block[0] === 'lookLike:') { /* Looks */

        source += 'S.setCostume(' + val(block[1]) + ');\n';

      } else if (block[0] === 'nextCostume') {

        source += 'S.showNextCostume();\n';

      } else if (block[0] === 'showBackground:' ||
                 block[0] === 'startScene') {

        source += 'self.setCostume(' + val(block[1]) + ');\n';
        source += 'var threads = sceneChange();\n';
        source += 'if (threads.indexOf(BASE) !== -1) {return;}\n';

      } else if (block[0] === 'nextBackground' ||
                 block[0] === 'nextScene') {

        source += 'S.showNextCostume();\n';
        source += 'var threads = sceneChange();\n';
        source += 'if (threads.indexOf(BASE) !== -1) {return;}\n';

      } else if (block[0] === 'startSceneAndWait') {

        source += 'save();\n';
        source += 'self.setCostume(' + val(block[1]) + ');\n';
        source += 'R.threads = sceneChange();\n';
        source += 'if (R.threads.indexOf(BASE) !== -1) {return;}\n';
        var id = label();
        source += 'if (!running(R.threads)) {\n';
        forceQueue(id);
        source += '}\n';
        source += 'restore();\n';

      } else if (block[0] === 'say:duration:elapsed:from:') {

        source += 'save();\n';
        source += 'R.id = S.say(' + val(block[1]) + ', false);\n';
        source += 'R.start = self.now;\n';
        source += 'R.duration = ' + num(block[2]) + ';\n';

        var id = label();
        source += 'if (self.now - R.start < R.duration * 1000) {\n';
        forceQueue(id);
        source += '}\n';

        source += 'if (S.sayId === R.id) {\n';
        source += '  S.say("");\n';
        source += '}\n';
        source += 'restore();\n';

      } else if (block[0] === 'say:') {

        source += 'S.say(' + val(block[1]) + ', false);\n';

      } else if (block[0] === 'think:duration:elapsed:from:') {

        source += 'save();\n';
        source += 'R.id = S.say(' + val(block[1]) + ', true);\n';
        source += 'R.start = self.now;\n';
        source += 'R.duration = ' + num(block[2]) + ';\n';

        var id = label();
        source += 'if (self.now - R.start < R.duration * 1000) {\n';
        forceQueue(id);
        source += '}\n';

        source += 'if (S.sayId === R.id) {\n';
        source += '  S.say("");\n';
        source += '}\n';
        source += 'restore();\n';

      } else if (block[0] === 'think:') {

        source += 'S.say(' + val(block[1]) + ', true);\n';

      } else if (block[0] === 'changeGraphicEffect:by:') {

        source += 'S.changeFilter(' + val(block[1]) + ', ' + num(block[2]) + ');\n';

      } else if (block[0] === 'setGraphicEffect:to:') {

        source += 'S.setFilter(' + val(block[1]) + ', ' + num(block[2]) + ');\n';

      } else if (block[0] === 'filterReset') {

        source += 'S.resetFilters();\n';

      } else if (block[0] === 'changeSizeBy:') {

        source += 'var f = S.scale + ' + num(block[1]) + ' / 100;\n';
        source += 'S.scale = f < 0 ? 0 : f;\n';

      } else if (block[0] === 'setSizeTo:') {

        source += 'var f = ' + num(block[1]) + ' / 100;\n';
        source += 'S.scale = f < 0 ? 0 : f;\n';

      } else if (block[0] === 'show') {

        source += 'S.visible = true;\n';
        source += 'if (S.saying) S.updateBubble();\n';

      } else if (block[0] === 'hide') {

        source += 'S.visible = false;\n';
        source += 'if (S.saying) S.updateBubble();\n';

      } else if (block[0] === 'comeToFront') {

        source += 'var i = self.children.indexOf(S);\n';
        source += 'if (i !== -1) self.children.splice(i, 1);\n';
        source += 'self.children.push(S);\n';

      } else if (block[0] === 'goBackByLayers:') {

        source += 'var i = self.children.indexOf(S);\n';
        source += 'if (i !== -1) {\n';
        source += '  self.children.splice(i, 1);\n';
        source += '  self.children.splice(Math.max(0, i - ' + num(block[1]) + '), 0, S);\n';
        source += '}\n';

      // } else if (block[0] === 'setVideoState') {

      // } else if (block[0] === 'setVideoTransparency') {

      } else if (block[0] === 'playSound:') { /* Sound */

        if (P.audioContext) {
          source += 'var sound = S.getSound(' + val(block[1]) + ');\n';
          source += 'if (sound) playSound(sound);\n';
        }

      } else if (block[0] === 'doPlaySoundAndWait') {

        if (P.audioContext) {
          source += 'var sound = S.getSound(' + val(block[1]) + ');\n';
          source += 'if (sound) {\n';
          source += '  playSound(sound);\n';
          wait('sound.duration');
          source += '}\n';
        }

      } else if (block[0] === 'stopAllSounds') {

        if (P.audioContext) {
          source += 'self.stopAllSounds();\n';
        }

      // } else if (block[0] === 'drum:duration:elapsed:from:') {

      } else if (block[0] === 'playDrum') {

        beatHead(block[2]);
        if (P.audioContext) {
          source += 'playSpan(DRUMS[Math.round(' + num(block[1]) + ') - 1] || DRUMS[2], 60, 10);\n';
        }
        beatTail();

      } else if (block[0] === 'rest:elapsed:from:') {

        beatHead(block[1]);
        beatTail();

      } else if (block[0] === 'noteOn:duration:elapsed:from:') {

        beatHead(block[2]);
        if (P.audioContext) {
          source += 'playNote(' + num(block[1]) + ', R.duration);\n';
        }
        beatTail();

      // } else if (block[0] === 'midiInstrument:') {

      } else if (block[0] === 'instrument:') {

        source += 'S.instrument = Math.max(0, Math.min(INSTRUMENTS.length - 1, ' + num(block[1]) + ' - 1)) | 0;';

      } else if (block[0] === 'changeVolumeBy:' || block[0] === 'setVolumeTo:') {

        source += 'S.volume = Math.min(1, Math.max(0, ' + (block[0] === 'changeVolumeBy:' ? 'S.volume + ' : '') + num(block[1]) + ' / 100));\n';
        source += 'if (S.node) S.node.gain.setValueAtTime(S.volume, audioContext.currentTime);\n';
        source += 'for (var sounds = S.sounds, i = sounds.length; i--;) {\n';
        source += '  var sound = sounds[i];\n';
        source += '  if (sound.node && sound.target === S) {\n';
        source += '    sound.node.gain.setValueAtTime(S.volume, audioContext.currentTime);\n';
        source += '  }\n';
        source += '}\n';

      } else if (block[0] === 'changeTempoBy:') {

        source += 'self.tempoBPM += ' + num(block[1]) + ';\n';

      } else if (block[0] === 'setTempoTo:') {

        source += 'self.tempoBPM = ' + num(block[1]) + ';\n';

      } else if (block[0] === 'clearPenTrails') { /* Pen */

        source += 'self.penCanvas.width = 480 * self.maxZoom;\n';
        source += 'self.penContext.scale(self.maxZoom, self.maxZoom);\n';
        source += 'self.penContext.lineCap = "round";\n'

      } else if (block[0] === 'putPenDown') {

        source += 'S.isPenDown = true;\n';
        source += 'S.dotPen();\n';

      } else if (block[0] === 'putPenUp') {

        source += 'S.isPenDown = false;\n';
        source += 'S.penState = null;\n';

      } else if (block[0] === 'penColor:') {

        source += 'var c = ' + num(block[1]) + ';\n';
        source += 'S.penColor = c;\n';
        source += 'var a = (c >> 24 & 0xff) / 0xff;\n';
        source += 'S.penCSS = "rgba(" + (c >> 16 & 0xff) + "," + (c >> 8 & 0xff) + "," + (c & 0xff) + ", " + (a || 1) + ")";\n';

      } else if (block[0] === 'setPenHueTo:') {

        source += noRGB;
        source += 'S.penHue = ' + num(block[1]) + ' * 360 / 200;\n';
        source += 'S.penSaturation = 100;\n';

      } else if (block[0] === 'changePenHueBy:') {

        source += noRGB;
        source += 'S.penHue += ' + num(block[1]) + ' * 360 / 200;\n';
        source += 'S.penSaturation = 100;\n';

      } else if (block[0] === 'setPenShadeTo:') {

        source += noRGB;
        source += 'S.penLightness = ' + num(block[1]) + ' % 200;\n';
        source += 'if (S.penLightness < 0) S.penLightness += 200;\n';
        source += 'S.penSaturation = 100;\n';

      } else if (block[0] === 'changePenShadeBy:') {

        source += noRGB;
        source += 'S.penLightness = (S.penLightness + ' + num(block[1]) + ') % 200;\n';
        source += 'if (S.penLightness < 0) S.penLightness += 200;\n';
        source += 'S.penSaturation = 100;\n';

      } else if (block[0] === 'penSize:') {

        source += 'var f = ' + num(block[1]) + ';\n';
        source += 'S.penSize = f < 1 ? 1 : f;\n';

      } else if (block[0] === 'changePenSizeBy:') {

        source += 'var f = S.penSize + ' + num(block[1]) + ';\n';
        source += 'S.penSize = f < 1 ? 1 : f;\n';

      } else if (block[0] === 'stampCostume') {

        source += 'S.draw(self.penContext);\n';

      } else if (block[0] === 'setVar:to:') { /* Data */

        source += varRef(block[1]) + ' = ' + val(block[2]) + ';\n';

      } else if (block[0] === 'changeVar:by:') {

        var ref = varRef(block[1]);
        source += ref + ' = (+' + ref + ' || 0) + ' + num(block[2]) + ';\n';

      } else if (block[0] === 'append:toList:') {

        source += 'appendToList(' + listRef(block[2]) + ', ' + val(block[1]) + ');\n';

      } else if (block[0] === 'deleteLine:ofList:') {

        source += 'deleteLineOfList(' + listRef(block[2]) + ', ' + val(block[1]) + ');\n';

      } else if (block[0] === 'insert:at:ofList:') {

        source += 'insertInList(' + listRef(block[3]) + ', ' + val(block[2]) + ', '+ val(block[1]) + ');\n';

      } else if (block[0] === 'setLine:ofList:to:') {

        source += 'setLineOfList(' + listRef(block[2]) + ', ' + val(block[1]) + ', '+ val(block[3]) + ');\n';

      } else if (block[0] === 'showVariable:' || block[0] === 'hideVariable:') {

        var isShow = block[0] === 'showVariable:';
        if (typeof block[1] !== 'string') {
          throw new Error('Dynamic variables are not supported');
        }
        var o = object.vars[block[1]] !== undefined ? 'S' : 'self';
        source += o + '.showVariable(' + val(block[1]) + ', ' + isShow + ');\n';

      // } else if (block[0] === 'showList:') {

      // } else if (block[0] === 'hideList:') {

      } else if (block[0] === 'broadcast:') { /* Control */

        source += 'var threads = broadcast(' + val(block[1]) + ');\n';
        source += 'if (threads.indexOf(BASE) !== -1) {return;}\n';

      } else if (block[0] === 'call') {

        if (DEBUG && block[1] === 'phosphorus: debug') {
          source += 'debugger;\n';
        } else {
          source += 'call(S.procedures[' + val(block[1]) + '], ' + nextLabel() + ', [';
          for (var i = 2; i < block.length; i++) {
            if (i > 2) {
              source += ', ';
            }
            source += val(block[i]);
          }
          source += ']);\n';
          delay();
        }

      } else if (block[0] === 'doBroadcastAndWait') {

        source += 'save();\n';
        source += 'R.threads = broadcast(' + val(block[1]) + ');\n';
        source += 'if (R.threads.indexOf(BASE) !== -1) {return;}\n';
        var id = label();
        source += 'if (running(R.threads)) {\n';
        forceQueue(id);
        source += '}\n';
        source += 'restore();\n';

      } else if (block[0] === 'doForever') {

        var id = label();
        seq(block[1]);
        forceQueue(id);

      } else if (block[0] === 'doForeverIf') {

        var id = label();

        source += 'if (' + bool(block[1]) + ') {\n';
        seq(block[2]);
        source += '}\n';

        forceQueue(id);

      // } else if (block[0] === 'doForLoop') {

      } else if (block[0] === 'doIf') {

        source += 'if (' + bool(block[1]) + ') {\n';
        seq(block[2]);
        source += '}\n';

      } else if (block[0] === 'doIfElse') {

        source += 'if (' + bool(block[1]) + ') {\n';
        seq(block[2]);
        source += '} else {\n';
        seq(block[3]);
        source += '}\n';

      } else if (block[0] === 'doRepeat') {

        source += 'save();\n';
        source += 'R.count = ' + num(block[1]) + ';\n';

        var id = label();

        source += 'if (R.count >= 0.5) {\n';
        source += '  R.count -= 1;\n';
        seq(block[2]);
        queue(id);
        source += '} else {\n';
        source += '  restore();\n';
        source += '}\n';

      } else if (block[0] === 'doReturn') {

        source += 'endCall();\n';
        source += 'return;\n';

      } else if (block[0] === 'doUntil') {

        var id = label();
        source += 'if (!' + bool(block[1]) + ') {\n';
        seq(block[2]);
        queue(id);
        source += '}\n';

      } else if (block[0] === 'doWhile') {

        var id = label();
        source += 'if (' + bool(block[1]) + ') {\n';
        seq(block[2]);
        queue(id);
        source += '}\n';

      } else if (block[0] === 'doWaitUntil') {

        var id = label();
        source += 'if (!' + bool(block[1]) + ') {\n';
        queue(id);
        source += '}\n';

      } else if (block[0] === 'glideSecs:toX:y:elapsed:from:') {

        source += 'save();\n';
        source += 'R.start = self.now;\n';
        source += 'R.duration = ' + num(block[1]) + ';\n';
        source += 'R.baseX = S.scratchX;\n';
        source += 'R.baseY = S.scratchY;\n';
        source += 'R.deltaX = ' + num(block[2]) + ' - S.scratchX;\n';
        source += 'R.deltaY = ' + num(block[3]) + ' - S.scratchY;\n';

        var id = label();
        source += 'var f = (self.now - R.start) / (R.duration * 1000);\n';
        source += 'if (f > 1) f = 1;\n';
        source += 'S.moveTo(R.baseX + f * R.deltaX, R.baseY + f * R.deltaY);\n';

        source += 'if (f < 1) {\n';
        forceQueue(id);
        source += '}\n';
        source += 'restore();\n';

      } else if (block[0] === 'stopAll') {

        source += 'self.stopAll();\n';
        source += 'return;\n';

      } else if (block[0] === 'stopScripts') {

        source += 'switch (' + val(block[1]) + ') {\n';
        source += '  case "all":\n';
        source += '    self.stopAll();\n';
        source += '    return;\n';
        source += '  case "this script":\n';
        source += '    endCall();\n';
        source += '    return;\n';
        source += '  case "other scripts in sprite":\n';
        source += '  case "other scripts in stage":\n';
        source += '    for (var i = 0; i < self.queue.length; i++) {\n';
        source += '      if (i !== THREAD && self.queue[i] && self.queue[i].sprite === S) {\n';
        source += '        self.queue[i] = undefined;\n';
        source += '      }\n';
        source += '    }\n';
        source += '    break;\n';
        source += '}\n';

      } else if (block[0] === 'wait:elapsed:from:') {

        wait(num(block[1]));

      } else if (block[0] === 'warpSpeed') {

        source += 'WARP++;\n';
        seq(block[1]);
        source += 'WARP--;\n';

      } else if (block[0] === 'createCloneOf') {

        source += 'clone(' + val(block[1]) + ');\n';

      } else if (block[0] === 'deleteClone') {

        source += 'if (S.isClone) {\n';
        source += '  S.remove();\n';
        source += '  var i = self.children.indexOf(S);\n';
        source += '  if (i !== -1) self.children.splice(i, 1);\n';
        source += '  for (var i = 0; i < self.queue.length; i++) {\n';
        source += '    if (self.queue[i] && self.queue[i].sprite === S) {\n';
        source += '      self.queue[i] = undefined;\n';
        source += '    }\n';
        source += '  }\n';
        source += '  return;\n';
        source += '}\n';

      } else if (block[0] === 'doAsk') { /* Sensing */

        source += 'R.id = self.nextPromptId++;\n';

        var id = label();
        source += 'if (self.promptId < R.id) {\n';
        forceQueue(id);
        source += '}\n';

        source += 'S.ask(' + val(block[1]) + ');\n';

        var id = label();
        source += 'if (self.promptId === R.id) {\n';
        forceQueue(id);
        source += '}\n';

      } else if (block[0] === 'timerReset') {

        source += 'self.timerStart = self.now;\n';

      } else {

        warn('Undefined command: ' + block[0]);

      }
    };

    var source = '';
    var startfn = object.fns.length;
    var fns = [0];

    if (script[0][0] === 'procDef') {
      var inputs = script[0][2];
      var types = script[0][1].match(/%[snmdcb]/g) || [];
      var used = [];
    }

    for (var i = 1; i < script.length; i++) {
      compile(script[i]);
    }

    if (script[0][0] === 'procDef') {
      var pre = '';
      for (var i = types.length; i--;) if (used[i]) {
        var t = types[i];
        if (t === '%d' || t === '%n' || t === '%c') {
          pre += 'C.numargs[' + i + '] = +C.args[' + i + '] || 0;\n';
        } else if (t === '%b') {
          pre += 'C.boolargs[' + i + '] = bool(C.args[' + i + ']);\n';
        }
      }
      source = pre + source;
      for (var i = 1, l = fns.length; i < l; ++i) {
        fns[i] += pre.length;
      }
      source += 'endCall();\n';
      source += 'return;\n';
    }

    var createContinuation = function(source) {
      var result = '(function() {\n';
      var brackets = 0;
      var delBrackets = 0;
      var shouldDelete = false;
      var here = 0;
      var length = source.length;
      while (here < length) {
        var i = source.indexOf('{', here);
        var j = source.indexOf('}', here);
        var k = source.indexOf('return;', here);
        if (k === -1) k = length;
        if (i === -1 && j === -1) {
          if (!shouldDelete) {
            result += source.slice(here, k);
          }
          break;
        }
        if (i === -1) i = length;
        if (j === -1) j = length;
        if (shouldDelete) {
          if (i < j) {
            delBrackets++;
            here = i + 1;
          } else {
            delBrackets--;
            if (!delBrackets) {
              shouldDelete = false;
            }
            here = j + 1;
          }
        } else {
          if (brackets === 0 && k < i && k < j) {
            result += source.slice(here, k);
            break;
          }
          if (i < j) {
            result += source.slice(here, i + 1);
            brackets++;
            here = i + 1;
          } else {
            result += source.slice(here, j);
            here = j + 1;
            if (source.substr(j, 8) === '} else {') {
              if (brackets > 0) {
                result += '} else {';
                here = j + 8;
              } else {
                shouldDelete = true;
                delBrackets = 0;
              }
            } else {
              if (brackets > 0) {
                result += '}';
                brackets--;
              }
            }
          }
        }
      }
      result += '})';
      return P.runtime.scopedEval(result);
    };

    for (var i = 0; i < fns.length; i++) {
      object.fns.push(createContinuation(source.slice(fns[i])));
    }

    var f = object.fns[startfn];

    if (script[0][0] === 'whenClicked') {
      object.listeners.whenClicked.push(f);
    } else if (script[0][0] === 'whenGreenFlag') {
      object.listeners.whenGreenFlag.push(f);
    } else if (script[0][0] === 'whenCloned') {
      object.listeners.whenCloned.push(f);
    } else if (script[0][0] === 'whenIReceive') {
      var key = script[0][1].toLowerCase();
      (object.listeners.whenIReceive[key] || (object.listeners.whenIReceive[key] = [])).push(f);
    } else if (script[0][0] === 'whenKeyPressed') {
      if (script[0][1] === 'any') {
        for (var i = 128; i--;) {
          object.listeners.whenKeyPressed[i].push(f);
        }
      } else {
        object.listeners.whenKeyPressed[P.getKeyCode(script[0][1])].push(f);
      }
    } else if (script[0][0] === 'whenSceneStarts') {
      var key = script[0][1].toLowerCase();
      (object.listeners.whenSceneStarts[key] || (object.listeners.whenSceneStarts[key] = [])).push(f);
    } else if (script[0][0] === 'procDef') {
      object.procedures[script[0][1]] = {
        inputs: inputs,
        warp: script[0][4],
        fn: f
      };
    } else {
      warn('Undefined event: ' + script[0][0]);
    }
  };

  return function(stage) {

    warnings = Object.create(null);

    compileScripts(stage);

    for (var i = 0; i < stage.children.length; i++) {
      compileScripts(stage.children[i]);
    }

    for (var key in warnings) {
      console.warn(key + (warnings[key] > 1 ? ' (repeated ' + warnings[key] + ' times)' : ''));
    }

  };

}());

P.runtime = (function() {
  'use strict';

  var self, S, R, STACK, C, WARP, CALLS, BASE, THREAD, IMMEDIATE, VISUAL;

  var bool = function(v) {
    return +v !== 0 && v !== '' && v !== 'false' && v !== false;
  };

  var DIGIT = /\d/;
  var compare = function(x, y) {
    if ((typeof x === 'number' || DIGIT.test(x)) && (typeof y === 'number' || DIGIT.test(y))) {
      var nx = +x;
      var ny = +y;
      if (nx === nx && ny === ny) {
        return nx < ny ? -1 : nx === ny ? 0 : 1;
      }
    }
    var xs = ('' + x).toLowerCase();
    var ys = ('' + y).toLowerCase();
    return xs < ys ? -1 : xs === ys ? 0 : 1;
  };
  var numLess = function(nx, y) {
    if (typeof y === 'number' || DIGIT.test(y)) {
      var ny = +y;
      if (ny === ny) {
        return nx < ny;
      }
    }
    var ys = ('' + y).toLowerCase();
    return '' + nx < ys;
  };
  var numGreater = function(nx, y) {
    if (typeof y === 'number' || DIGIT.test(y)) {
      var ny = +y;
      if (ny === ny) {
        return nx > ny;
      }
    }
    var ys = ('' + y).toLowerCase();
    return '' + nx > ys;
  };

  var equal = function(x, y) {
    if ((typeof x === 'number' || DIGIT.test(x)) && (typeof y === 'number' || DIGIT.test(y))) {
      var nx = +x;
      var ny = +y;
      if (nx === nx && ny === ny) {
        return nx === ny;
      }
    }
    var xs = ('' + x).toLowerCase();
    var ys = ('' + y).toLowerCase();
    return xs === ys;
  };
  var numEqual = function(nx, y) {
    if (typeof y === 'number' || DIGIT.test(y)) {
      var ny = +y;
      return ny === ny && nx === ny;
    }
    return false;
  };

  var mod = function(x, y) {
    var r = x % y;
    if (r / y < 0) {
      r += y;
    }
    return r;
  };

  var random = function(x, y) {
    x = +x || 0;
    y = +y || 0;
    if (x > y) {
      var tmp = y;
      y = x;
      x = tmp;
    }
    if (x % 1 === 0 && y % 1 === 0) {
      return Math.floor(Math.random() * (y - x + 1)) + x;
    }
    return Math.random() * (y - x) + x;
  };

  var rgb2hsl = function(rgb) {
    var r = (rgb >> 16 & 0xff) / 0xff;
    var g = (rgb >> 8 & 0xff) / 0xff;
    var b = (rgb & 0xff) / 0xff;

    var min = Math.min(r, g, b);
    var max = Math.max(r, g, b);

    if (min === max) {
      return [0, 0, r * 100];
    }

    var c = max - min;
    var l = (min + max) / 2;
    var s = c / (1 - Math.abs(2 * l - 1));

    var h;
    switch (max) {
      case r: h = ((g - b) / c + 6) % 6; break;
      case g: h = (b - r) / c + 2; break;
      case b: h = (r - g) / c + 4; break;
    }
    h *= 60;

    return [h, s * 100, l * 100];
  };

  var clone = function(name) {
    var parent = name === '_myself_' ? S : self.getObject(name);
    var c = parent.clone();
    self.children.splice(self.children.indexOf(parent), 0, c);
    self.triggerFor(c, 'whenCloned');
  };

  var epoch = Date.UTC(2000, 0, 1);

  var timeAndDate = P.Watcher.timeAndDate;

  var getVars = function(name) {
    return self.vars[name] !== undefined ? self.vars : S.vars;
  };

  var getLists = function(name) {
    if (self.lists[name] !== undefined) return self.lists;
    if (S.lists[name] === undefined) {
      S.lists[name] = [];
    }
    return S.lists;
  };

  var listIndex = function(list, index, length) {
    var i = index | 0;
    if (i === index) return i > 0 && i <= length ? i - 1 : -1;
    if (index === 'random' || index === 'any') {
      return Math.random() * length | 0;
    }
    if (index === 'last') {
      return length - 1;
    }
    return i > 0 && i <= length ? i - 1 : -1;
  };

  var contentsOfList = function(list) {
    var isSingle = true;
    for (var i = list.length; i--;) {
      if (list[i].length !== 1) {
        isSingle = false;
        break;
      }
    }
    return list.join(isSingle ? '' : ' ');
  };

  var getLineOfList = function(list, index) {
    var i = listIndex(list, index, list.length);
    return i !== -1 ? list[i] : '';
  };

  var listContains = function(list, value) {
    for (var i = list.length; i--;) {
      if (equal(list[i], value)) return true;
    }
    return false;
  };

  var appendToList = function(list, value) {
    list.push(value);
  };

  var deleteLineOfList = function(list, index) {
    if (index === 'all') {
      list.length = 0;
    } else {
      var i = listIndex(list, index, list.length);
      if (i === list.length - 1) {
        list.pop();
      } else if (i !== -1) {
        list.splice(i, 1);
      }
    }
  };

  var insertInList = function(list, index, value) {
    var i = listIndex(list, index, list.length + 1);
    if (i === list.length) {
      list.push(value);
    } else if (i !== -1) {
      list.splice(i, 0, value);
    }
  };

  var setLineOfList = function(list, index, value) {
    var i = listIndex(list, index, list.length);
    if (i !== -1) {
      list[i] = value;
    }
  };

  var mathFunc = function(f, x) {
    switch (f) {
      case 'abs':
        return Math.abs(x);
      case 'floor':
        return Math.floor(x);
      case 'sqrt':
        return Math.sqrt(x);
      case 'ceiling':
        return Math.ceil(x);
      case 'cos':
        return Math.cos(x * Math.PI / 180);
      case 'sin':
        return Math.sin(x * Math.PI / 180);
      case 'tan':
        return Math.tan(x * Math.PI / 180);
      case 'asin':
        return Math.asin(x) * 180 / Math.PI;
      case 'acos':
        return Math.acos(x) * 180 / Math.PI;
      case 'atan':
        return Math.atan(x) * 180 / Math.PI;
      case 'ln':
        return Math.log(x);
      case 'log':
        return Math.log(x) / Math.LN10;
      case 'e ^':
        return Math.exp(x);
      case '10 ^':
        return Math.exp(x * Math.LN10);
    }
    return 0;
  };

  var attribute = function(attr, objName) {
    var o = self.getObject(objName);
    if (!o) return 0;
    if (o.isSprite) {
      switch (attr) {
        case 'x position': return o.scratchX;
        case 'y position': return o.scratchY;
        case 'direction': return o.direction;
        case 'costume #': return o.currentCostumeIndex + 1;
        case 'costume name': return o.costumes[o.currentCostumeIndex].costumeName;
        case 'size': return o.scale * 100;
        case 'volume': return 0; // TODO
      }
    } else {
      switch (attr) {
        case 'background #':
        case 'backdrop #': return o.currentCostumeIndex + 1;
        case 'backdrop name': return o.costumes[o.currentCostumeIndex].costumeName;
        case 'volume': return 0; // TODO
      }
    }
    var value = o.vars[attr];
    if (value !== undefined) {
      return value;
    }
    return 0;
  };

  var VOLUME = 0.3;

  var audioContext = P.audioContext;
  if (audioContext) {
    var wavBuffers = P.IO.wavBuffers;

    var volumeNode = audioContext.createGain();
    volumeNode.gain.value = VOLUME;
    volumeNode.connect(audioContext.destination);

    var playNote = function(id, duration) {
      var spans = INSTRUMENTS[S.instrument];
      for (var i = 0, l = spans.length; i < l; i++) {
        var span = spans[i];
        if (span.top >= id || span.top === 128) break;
      }
      playSpan(span, Math.max(0, Math.min(127, id)), duration);
    };

    var playSpan = function(span, id, duration) {
      if (!S.node) {
        S.node = audioContext.createGain();
        S.node.gain.value = S.volume;
        S.node.connect(volumeNode);
      }

      var source = audioContext.createBufferSource();
      var note = audioContext.createGain();
      var buffer = wavBuffers[span.name];
      if (!buffer) return;

      source.buffer = buffer;
      if (source.loop = span.loop) {
        source.loopStart = span.loopStart;
        source.loopEnd = span.loopEnd;
      }

      source.connect(note);
      note.connect(S.node);

      var time = audioContext.currentTime;
      source.playbackRate.value = Math.pow(2, (id - 69) / 12) / span.baseRatio;

      var gain = note.gain;
      gain.value = 0;
      gain.setValueAtTime(0, time);
      if (span.attackEnd < duration) {
        gain.linearRampToValueAtTime(1, time + span.attackEnd);
        if (span.decayTime > 0 && span.holdEnd < duration) {
          gain.linearRampToValueAtTime(1, time + span.holdEnd);
          if (span.decayEnd < duration) {
            gain.linearRampToValueAtTime(0, time + span.decayEnd);
          } else {
            gain.linearRampToValueAtTime(1 - (duration - holdEnd) / span.decayTime, time + duration);
          }
        } else {
          gain.linearRampToValueAtTime(1, time + duration);
        }
      } else {
        gain.linearRampToValueAtTime(1, time + duration);
      }
      gain.linearRampToValueAtTime(0, time + duration + 0.02267573696);

      source.start(time);
      source.stop(time + duration + 0.02267573696);
    };

    var playSound = function(sound) {
      if (!sound.buffer) return;
      if (!sound.node) {
        sound.node = audioContext.createGain();
        sound.node.gain.value = S.volume;
        sound.node.connect(volumeNode);
      }
      sound.target = S;
      sound.node.gain.setValueAtTime(S.volume, audioContext.currentTime);

      if (sound.source) {
        sound.source.disconnect();
      }
      sound.source = audioContext.createBufferSource();
      sound.source.buffer = sound.buffer;
      sound.source.connect(sound.node);

      sound.source.start(audioContext.currentTime);
    };
  }

  var save = function() {
    STACK.push(R);
    R = {};
  };

  var restore = function() {
    R = STACK.pop();
  };

  // var lastCalls = [];
  var call = function(procedure, id, values) {
    // lastCalls.push(spec);
    // if (lastCalls.length > 10000) lastCalls.shift();
    if (procedure) {
      STACK.push(R);
      CALLS.push(C);
      C = {
        base: procedure.fn,
        fn: S.fns[id],
        args: values,
        numargs: [],
        boolargs: [],
        stack: STACK = [],
        warp: procedure.warp
      };
      R = {};
      if (C.warp || WARP) {
        WARP++;
        IMMEDIATE = procedure.fn;
      } else {
        for (var i = CALLS.length, j = 5; i-- && j--;) {
          if (CALLS[i].base === procedure.fn) {
            var recursive = true;
            break;
          }
        }
        if (recursive) {
          self.queue[THREAD] = {
            sprite: S,
            base: BASE,
            fn: procedure.fn,
            calls: CALLS
          };
        } else {
          IMMEDIATE = procedure.fn;
        }
      }
    } else {
      IMMEDIATE = S.fns[id];
    }
  };

  var endCall = function() {
    if (CALLS.length) {
      if (WARP) WARP--;
      IMMEDIATE = C.fn;
      C = CALLS.pop();
      STACK = C.stack;
      R = STACK.pop();
    }
  };

  var sceneChange = function() {
    return self.trigger('whenSceneStarts', self.costumes[self.currentCostumeIndex].costumeName);
  };

  var broadcast = function(name) {
    return self.trigger('whenIReceive', name);
  };

  var running = function(bases) {
    for (var j = 0; j < self.queue.length; j++) {
      if (self.queue[j] && bases.indexOf(self.queue[j].base) !== -1) return true;
    }
    return false;
  };

  var queue = function(id) {
    if (WARP) {
      IMMEDIATE = S.fns[id];
    } else {
      forceQueue(id);
    }
  };

  var forceQueue = function(id) {
    self.queue[THREAD] = {
      sprite: S,
      base: BASE,
      fn: S.fns[id],
      calls: CALLS
    };
  };

  // Internal definition
  (function() {
    'use strict';

    P.Stage.prototype.framerate = 30;

    P.Stage.prototype.initRuntime = function() {
      this.queue = [];
      this.onError = this.onError.bind(this);
    };

    P.Stage.prototype.startThread = function(sprite, base) {
      var thread = {
        sprite: sprite,
        base: base,
        fn: base,
        calls: [{args: [], stack: [{}]}]
      };
      for (var i = 0; i < this.queue.length; i++) {
        var q = this.queue[i];
        if (q && q.sprite === sprite && q.base === base) {
          this.queue[i] = thread;
          return;
        }
      }
      this.queue.push(thread);
    };

    P.Stage.prototype.triggerFor = function(sprite, event, arg) {
      var threads;
      if (event === 'whenClicked') {
        threads = sprite.listeners.whenClicked;
      } else if (event === 'whenCloned') {
        threads = sprite.listeners.whenCloned;
      } else if (event === 'whenGreenFlag') {
        threads = sprite.listeners.whenGreenFlag;
      } else if (event === 'whenIReceive') {
        threads = sprite.listeners.whenIReceive[('' + arg).toLowerCase()];
      } else if (event === 'whenKeyPressed') {
        threads = sprite.listeners.whenKeyPressed[arg];
      } else if (event === 'whenSceneStarts') {
        threads = sprite.listeners.whenSceneStarts[('' + arg).toLowerCase()];
      }
      if (threads) {
        for (var i = 0; i < threads.length; i++) {
          this.startThread(sprite, threads[i]);
        }
      }
      return threads || [];
    };

    P.Stage.prototype.trigger = function(event, arg) {
      var threads = [];
      for (var i = this.children.length; i--;) {
        threads = threads.concat(this.triggerFor(this.children[i], event, arg));
      }
      return threads.concat(this.triggerFor(this, event, arg));
    };

    P.Stage.prototype.triggerGreenFlag = function() {
      this.timerStart = this.rightNow();
      this.trigger('whenGreenFlag');
    };

    P.Stage.prototype.start = function() {
      this.isRunning = true;
      if (this.interval) return;
      addEventListener('error', this.onError);
      this.baseTime = Date.now();
      this.interval = setInterval(this.step.bind(this), 1000 / this.framerate);
      if (audioContext) audioContext.resume();
    };

    P.Stage.prototype.pause = function() {
      if (this.interval) {
        this.baseNow = this.rightNow();
        clearInterval(this.interval);
        delete this.interval;
        removeEventListener('error', this.onError);
        if (audioContext) audioContext.suspend();
      }
      this.isRunning = false;
    };

    P.Stage.prototype.stopAll = function() {
      this.hidePrompt = false;
      this.prompter.style.display = 'none';
      this.promptId = this.nextPromptId = 0;
      this.queue.length = 0;
      this.resetFilters();
      this.stopSounds();
      for (var i = 0; i < this.children.length; i++) {
        var c = this.children[i];
        if (c.isClone) {
          c.remove();
          this.children.splice(i, 1);
          i -= 1;
        } else {
          c.resetFilters();
          if (c.saying) c.say('');
          c.stopSounds();
        }
      }
    };

    P.Stage.prototype.rightNow = function() {
      return this.baseNow + Date.now() - this.baseTime;
    };

    P.Stage.prototype.step = function() {
      self = this;
      VISUAL = false;
      var start = Date.now();
      do {
        var queue = this.queue;
        this.now = this.rightNow();
        for (THREAD = 0; THREAD < queue.length; THREAD++) {
          if (queue[THREAD]) {
            S = queue[THREAD].sprite;
            IMMEDIATE = queue[THREAD].fn;
            BASE = queue[THREAD].base;
            CALLS = queue[THREAD].calls;
            C = CALLS.pop();
            STACK = C.stack;
            R = STACK.pop();
            queue[THREAD] = undefined;
            WARP = 0;
            while (IMMEDIATE) {
              var fn = IMMEDIATE;
              IMMEDIATE = null;
              fn();
            }
            STACK.push(R);
            CALLS.push(C);
          }
        }
        for (var i = queue.length; i--;) {
          if (!queue[i]) queue.splice(i, 1);
        }
      } while ((self.isTurbo || !VISUAL) && Date.now() - start < 1000 / this.framerate && queue.length);
      this.draw();
      S = null;
    };

    P.Stage.prototype.onError = function(e) {
      this.handleError(e.error);
      clearInterval(this.interval);
    };

    P.Stage.prototype.handleError = function(e) {
      console.error(e.stack);
    };

  }());

  /*
    copy(JSON.stringify(instruments.map(function(g) {
      return g.map(function(r) {
        var attackTime = r[5] ? r[5][0] * 0.001 : 0;
        var holdTime = r[5] ? r[5][1] * 0.001 : 0;
        var decayTime = r[5] ? r[5][2] : 0;
        var baseRatio = Math.pow(2, (r[2] - 69) / 12);
        if (r[3] !== -1) {
          var length = r[4] - r[3];
          baseRatio = 22050 * Math.round(length * 440 * baseRatio / 22050) / length / 440;
        }
        return {
          top: r[0],
          name: r[1],
          baseRatio: baseRatio,
          loop: r[3] !== -1,
          loopStart: r[3] / 22050,
          loopEnd: r[4] / 22050,
          attackEnd: attackTime,
          holdEnd: attackTime + holdTime,
          decayEnd: attackTime + holdTime + decayTime
        }
      })
    })).replace(/"(\w+)":/g,'$1:').replace(/"/g, '\''));
  */
  var INSTRUMENTS = [[{top:38,name:'AcousticPiano_As3',baseRatio:0.5316313272700484,loop:true,loopStart:0.465578231292517,loopEnd:0.7733786848072562,attackEnd:0,holdEnd:0.1,decayEnd:22.1},{top:44,name:'AcousticPiano_C4',baseRatio:0.5905141892259927,loop:true,loopStart:0.6334693877551021,loopEnd:0.8605442176870748,attackEnd:0,holdEnd:0.1,decayEnd:20.1},{top:51,name:'AcousticPiano_G4',baseRatio:0.8843582887700535,loop:true,loopStart:0.5532879818594104,loopEnd:0.5609977324263039,attackEnd:0,holdEnd:0.08,decayEnd:18.08},{top:62,name:'AcousticPiano_C6',baseRatio:2.3557692307692304,loop:true,loopStart:0.5914739229024943,loopEnd:0.6020861678004535,attackEnd:0,holdEnd:0.08,decayEnd:16.08},{top:70,name:'AcousticPiano_F5',baseRatio:1.5776515151515151,loop:true,loopStart:0.5634920634920635,loopEnd:0.5879818594104308,attackEnd:0,holdEnd:0.04,decayEnd:14.04},{top:77,name:'AcousticPiano_Ds6',baseRatio:2.800762112139358,loop:true,loopStart:0.560907029478458,loopEnd:0.5836281179138322,attackEnd:0,holdEnd:0.02,decayEnd:10.02},{top:85,name:'AcousticPiano_Ds6',baseRatio:2.800762112139358,loop:true,loopStart:0.560907029478458,loopEnd:0.5836281179138322,attackEnd:0,holdEnd:0,decayEnd:8},{top:90,name:'AcousticPiano_Ds6',baseRatio:2.800762112139358,loop:true,loopStart:0.560907029478458,loopEnd:0.5836281179138322,attackEnd:0,holdEnd:0,decayEnd:6},{top:96,name:'AcousticPiano_D7',baseRatio:5.275119617224881,loop:true,loopStart:0.3380498866213152,loopEnd:0.34494331065759637,attackEnd:0,holdEnd:0,decayEnd:3},{top:128,name:'AcousticPiano_D7',baseRatio:5.275119617224881,loop:true,loopStart:0.3380498866213152,loopEnd:0.34494331065759637,attackEnd:0,holdEnd:0,decayEnd:2}],[{top:48,name:'ElectricPiano_C2',baseRatio:0.14870515241435123,loop:true,loopStart:0.6956009070294784,loopEnd:0.7873015873015873,attackEnd:0,holdEnd:0.08,decayEnd:10.08},{top:74,name:'ElectricPiano_C4',baseRatio:0.5945685670261941,loop:true,loopStart:0.5181859410430839,loopEnd:0.5449433106575964,attackEnd:0,holdEnd:0.04,decayEnd:8.04},{top:128,name:'ElectricPiano_C4',baseRatio:0.5945685670261941,loop:true,loopStart:0.5181859410430839,loopEnd:0.5449433106575964,attackEnd:0,holdEnd:0,decayEnd:6}],[{top:128,name:'Organ_G2',baseRatio:0.22283731584620914,loop:true,loopStart:0.05922902494331066,loopEnd:0.1510204081632653,attackEnd:0,holdEnd:0,decayEnd:0}],[{top:40,name:'AcousticGuitar_F3',baseRatio:0.3977272727272727,loop:true,loopStart:1.6628117913832199,loopEnd:1.6685260770975057,attackEnd:0,holdEnd:0,decayEnd:15},{top:56,name:'AcousticGuitar_F3',baseRatio:0.3977272727272727,loop:true,loopStart:1.6628117913832199,loopEnd:1.6685260770975057,attackEnd:0,holdEnd:0,decayEnd:13.5},{top:60,name:'AcousticGuitar_F3',baseRatio:0.3977272727272727,loop:true,loopStart:1.6628117913832199,loopEnd:1.6685260770975057,attackEnd:0,holdEnd:0,decayEnd:12},{top:67,name:'AcousticGuitar_F3',baseRatio:0.3977272727272727,loop:true,loopStart:1.6628117913832199,loopEnd:1.6685260770975057,attackEnd:0,holdEnd:0,decayEnd:8.5},{top:72,name:'AcousticGuitar_F3',baseRatio:0.3977272727272727,loop:true,loopStart:1.6628117913832199,loopEnd:1.6685260770975057,attackEnd:0,holdEnd:0,decayEnd:7},{top:83,name:'AcousticGuitar_F3',baseRatio:0.3977272727272727,loop:true,loopStart:1.6628117913832199,loopEnd:1.6685260770975057,attackEnd:0,holdEnd:0,decayEnd:5.5},{top:128,name:'AcousticGuitar_F3',baseRatio:0.3977272727272727,loop:true,loopStart:1.6628117913832199,loopEnd:1.6685260770975057,attackEnd:0,holdEnd:0,decayEnd:4.5}],[{top:40,name:'ElectricGuitar_F3',baseRatio:0.39615522817103843,loop:true,loopStart:1.5733333333333333,loopEnd:1.5848072562358277,attackEnd:0,holdEnd:0,decayEnd:15},{top:56,name:'ElectricGuitar_F3',baseRatio:0.39615522817103843,loop:true,loopStart:1.5733333333333333,loopEnd:1.5848072562358277,attackEnd:0,holdEnd:0,decayEnd:13.5},{top:60,name:'ElectricGuitar_F3',baseRatio:0.39615522817103843,loop:true,loopStart:1.5733333333333333,loopEnd:1.5848072562358277,attackEnd:0,holdEnd:0,decayEnd:12},{top:67,name:'ElectricGuitar_F3',baseRatio:0.39615522817103843,loop:true,loopStart:1.5733333333333333,loopEnd:1.5848072562358277,attackEnd:0,holdEnd:0,decayEnd:8.5},{top:72,name:'ElectricGuitar_F3',baseRatio:0.39615522817103843,loop:true,loopStart:1.5733333333333333,loopEnd:1.5848072562358277,attackEnd:0,holdEnd:0,decayEnd:7},{top:83,name:'ElectricGuitar_F3',baseRatio:0.39615522817103843,loop:true,loopStart:1.5733333333333333,loopEnd:1.5848072562358277,attackEnd:0,holdEnd:0,decayEnd:5.5},{top:128,name:'ElectricGuitar_F3',baseRatio:0.39615522817103843,loop:true,loopStart:1.5733333333333333,loopEnd:1.5848072562358277,attackEnd:0,holdEnd:0,decayEnd:4.5}],[{top:34,name:'ElectricBass_G1',baseRatio:0.11111671034065712,loop:true,loopStart:1.9007709750566892,loopEnd:1.9212244897959183,attackEnd:0,holdEnd:0,decayEnd:17},{top:48,name:'ElectricBass_G1',baseRatio:0.11111671034065712,loop:true,loopStart:1.9007709750566892,loopEnd:1.9212244897959183,attackEnd:0,holdEnd:0,decayEnd:14},{top:64,name:'ElectricBass_G1',baseRatio:0.11111671034065712,loop:true,loopStart:1.9007709750566892,loopEnd:1.9212244897959183,attackEnd:0,holdEnd:0,decayEnd:12},{top:128,name:'ElectricBass_G1',baseRatio:0.11111671034065712,loop:true,loopStart:1.9007709750566892,loopEnd:1.9212244897959183,attackEnd:0,holdEnd:0,decayEnd:10}],[{top:38,name:'Pizz_G2',baseRatio:0.21979665071770335,loop:true,loopStart:0.3879365079365079,loopEnd:0.3982766439909297,attackEnd:0,holdEnd:0,decayEnd:5},{top:45,name:'Pizz_G2',baseRatio:0.21979665071770335,loop:true,loopStart:0.3879365079365079,loopEnd:0.3982766439909297,attackEnd:0,holdEnd:0.012,decayEnd:4.012},{top:56,name:'Pizz_A3',baseRatio:0.503654636820466,loop:true,loopStart:0.5197278911564626,loopEnd:0.5287528344671202,attackEnd:0,holdEnd:0,decayEnd:4},{top:64,name:'Pizz_A3',baseRatio:0.503654636820466,loop:true,loopStart:0.5197278911564626,loopEnd:0.5287528344671202,attackEnd:0,holdEnd:0,decayEnd:3.2},{top:72,name:'Pizz_E4',baseRatio:0.7479647218453188,loop:true,loopStart:0.7947845804988662,loopEnd:0.7978231292517007,attackEnd:0,holdEnd:0,decayEnd:2.8},{top:80,name:'Pizz_E4',baseRatio:0.7479647218453188,loop:true,loopStart:0.7947845804988662,loopEnd:0.7978231292517007,attackEnd:0,holdEnd:0,decayEnd:2.2},{top:128,name:'Pizz_E4',baseRatio:0.7479647218453188,loop:true,loopStart:0.7947845804988662,loopEnd:0.7978231292517007,attackEnd:0,holdEnd:0,decayEnd:1.5}],[{top:41,name:'Cello_C2',baseRatio:0.14870515241435123,loop:true,loopStart:0.3876643990929705,loopEnd:0.40294784580498866,attackEnd:0,holdEnd:0,decayEnd:0},{top:52,name:'Cello_As2',baseRatio:0.263755980861244,loop:true,loopStart:0.3385487528344671,loopEnd:0.35578231292517004,attackEnd:0,holdEnd:0,decayEnd:0},{top:62,name:'Violin_D4',baseRatio:0.6664047388781432,loop:true,loopStart:0.48108843537414964,loopEnd:0.5151927437641723,attackEnd:0,holdEnd:0,decayEnd:0},{top:75,name:'Violin_A4',baseRatio:0.987460815047022,loop:true,loopStart:0.14108843537414967,loopEnd:0.15029478458049886,attackEnd:0.07,holdEnd:0.07,decayEnd:0.07},{top:128,name:'Violin_E5',baseRatio:1.4885238523852387,loop:true,loopStart:0.10807256235827664,loopEnd:0.1126530612244898,attackEnd:0,holdEnd:0,decayEnd:0}],[{top:30,name:'BassTrombone_A2_3',baseRatio:0.24981872564125807,loop:true,loopStart:0.061541950113378686,loopEnd:0.10702947845804989,attackEnd:0,holdEnd:0,decayEnd:0},{top:40,name:'BassTrombone_A2_2',baseRatio:0.24981872564125807,loop:true,loopStart:0.08585034013605441,loopEnd:0.13133786848072562,attackEnd:0,holdEnd:0,decayEnd:0},{top:55,name:'Trombone_B3',baseRatio:0.5608240680183126,loop:true,loopStart:0.12,loopEnd:0.17673469387755103,attackEnd:0,holdEnd:0,decayEnd:0},{top:88,name:'Trombone_B3',baseRatio:0.5608240680183126,loop:true,loopStart:0.12,loopEnd:0.17673469387755103,attackEnd:0.05,holdEnd:0.05,decayEnd:0.05},{top:128,name:'Trumpet_E5',baseRatio:1.4959294436906376,loop:true,loopStart:0.1307936507936508,loopEnd:0.14294784580498865,attackEnd:0,holdEnd:0,decayEnd:0}],[{top:128,name:'Clarinet_C4',baseRatio:0.5940193965517241,loop:true,loopStart:0.6594104308390023,loopEnd:0.7014965986394558,attackEnd:0,holdEnd:0,decayEnd:0}],[{top:40,name:'TenorSax_C3',baseRatio:0.2971698113207547,loop:true,loopStart:0.4053968253968254,loopEnd:0.4895238095238095,attackEnd:0,holdEnd:0,decayEnd:0},{top:50,name:'TenorSax_C3',baseRatio:0.2971698113207547,loop:true,loopStart:0.4053968253968254,loopEnd:0.4895238095238095,attackEnd:0.02,holdEnd:0.02,decayEnd:0.02},{top:59,name:'TenorSax_C3',baseRatio:0.2971698113207547,loop:true,loopStart:0.4053968253968254,loopEnd:0.4895238095238095,attackEnd:0.04,holdEnd:0.04,decayEnd:0.04},{top:67,name:'AltoSax_A3',baseRatio:0.49814747876378096,loop:true,loopStart:0.3875736961451247,loopEnd:0.4103854875283447,attackEnd:0,holdEnd:0,decayEnd:0},{top:75,name:'AltoSax_A3',baseRatio:0.49814747876378096,loop:true,loopStart:0.3875736961451247,loopEnd:0.4103854875283447,attackEnd:0.02,holdEnd:0.02,decayEnd:0.02},{top:80,name:'AltoSax_A3',baseRatio:0.49814747876378096,loop:true,loopStart:0.3875736961451247,loopEnd:0.4103854875283447,attackEnd:0.02,holdEnd:0.02,decayEnd:0.02},{top:128,name:'AltoSax_C6',baseRatio:2.3782742681047764,loop:true,loopStart:0.05705215419501134,loopEnd:0.0838095238095238,attackEnd:0,holdEnd:0,decayEnd:0}],[{top:61,name:'Flute_B5_2',baseRatio:2.255113636363636,loop:true,loopStart:0.08430839002267573,loopEnd:0.10244897959183673,attackEnd:0,holdEnd:0,decayEnd:0},{top:128,name:'Flute_B5_1',baseRatio:2.255113636363636,loop:true,loopStart:0.10965986394557824,loopEnd:0.12780045351473923,attackEnd:0,holdEnd:0,decayEnd:0}],[{top:128,name:'WoodenFlute_C5',baseRatio:1.1892952324548416,loop:true,loopStart:0.5181859410430839,loopEnd:0.7131065759637188,attackEnd:0,holdEnd:0,decayEnd:0}],[{top:57,name:'Bassoon_C3',baseRatio:0.29700969827586204,loop:true,loopStart:0.11011337868480725,loopEnd:0.19428571428571428,attackEnd:0,holdEnd:0,decayEnd:0},{top:67,name:'Bassoon_C3',baseRatio:0.29700969827586204,loop:true,loopStart:0.11011337868480725,loopEnd:0.19428571428571428,attackEnd:0.04,holdEnd:0.04,decayEnd:0.04},{top:76,name:'Bassoon_C3',baseRatio:0.29700969827586204,loop:true,loopStart:0.11011337868480725,loopEnd:0.19428571428571428,attackEnd:0.08,holdEnd:0.08,decayEnd:0.08},{top:84,name:'EnglishHorn_F3',baseRatio:0.39601293103448276,loop:true,loopStart:0.341859410430839,loopEnd:0.4049886621315193,attackEnd:0.04,holdEnd:0.04,decayEnd:0.04},{top:128,name:'EnglishHorn_D4',baseRatio:0.6699684005833739,loop:true,loopStart:0.22027210884353743,loopEnd:0.23723356009070296,attackEnd:0,holdEnd:0,decayEnd:0}],[{top:39,name:'Choir_F3',baseRatio:0.3968814788643197,loop:true,loopStart:0.6352380952380953,loopEnd:1.8721541950113378,attackEnd:0,holdEnd:0,decayEnd:0},{top:50,name:'Choir_F3',baseRatio:0.3968814788643197,loop:true,loopStart:0.6352380952380953,loopEnd:1.8721541950113378,attackEnd:0.04,holdEnd:0.04,decayEnd:0.04},{top:61,name:'Choir_F3',baseRatio:0.3968814788643197,loop:true,loopStart:0.6352380952380953,loopEnd:1.8721541950113378,attackEnd:0.06,holdEnd:0.06,decayEnd:0.06},{top:72,name:'Choir_F4',baseRatio:0.7928898424161845,loop:true,loopStart:0.7415419501133786,loopEnd:2.1059410430839,attackEnd:0,holdEnd:0,decayEnd:0},{top:128,name:'Choir_F5',baseRatio:1.5879576065654504,loop:true,loopStart:0.836281179138322,loopEnd:2.0585487528344673,attackEnd:0,holdEnd:0,decayEnd:0}],[{top:38,name:'Vibraphone_C3',baseRatio:0.29829545454545453,loop:true,loopStart:0.2812698412698413,loopEnd:0.28888888888888886,attackEnd:0,holdEnd:0.1,decayEnd:8.1},{top:48,name:'Vibraphone_C3',baseRatio:0.29829545454545453,loop:true,loopStart:0.2812698412698413,loopEnd:0.28888888888888886,attackEnd:0,holdEnd:0.1,decayEnd:7.6},{top:59,name:'Vibraphone_C3',baseRatio:0.29829545454545453,loop:true,loopStart:0.2812698412698413,loopEnd:0.28888888888888886,attackEnd:0,holdEnd:0.06,decayEnd:7.06},{top:70,name:'Vibraphone_C3',baseRatio:0.29829545454545453,loop:true,loopStart:0.2812698412698413,loopEnd:0.28888888888888886,attackEnd:0,holdEnd:0.04,decayEnd:6.04},{top:78,name:'Vibraphone_C3',baseRatio:0.29829545454545453,loop:true,loopStart:0.2812698412698413,loopEnd:0.28888888888888886,attackEnd:0,holdEnd:0.02,decayEnd:5.02},{top:86,name:'Vibraphone_C3',baseRatio:0.29829545454545453,loop:true,loopStart:0.2812698412698413,loopEnd:0.28888888888888886,attackEnd:0,holdEnd:0,decayEnd:4},{top:128,name:'Vibraphone_C3',baseRatio:0.29829545454545453,loop:true,loopStart:0.2812698412698413,loopEnd:0.28888888888888886,attackEnd:0,holdEnd:0,decayEnd:3}],[{top:128,name:'MusicBox_C4',baseRatio:0.5937634640241276,loop:true,loopStart:0.6475283446712018,loopEnd:0.6666666666666666,attackEnd:0,holdEnd:0,decayEnd:2}],[{top:128,name:'SteelDrum_D5',baseRatio:1.3660402567543959,loop:false,loopStart:-0.000045351473922902495,loopEnd:-0.000045351473922902495,attackEnd:0,holdEnd:0,decayEnd:2}],[{top:128,name:'Marimba_C4',baseRatio:0.5946035575013605,loop:false,loopStart:-0.000045351473922902495,loopEnd:-0.000045351473922902495,attackEnd:0,holdEnd:0,decayEnd:0}],[{top:80,name:'SynthLead_C4',baseRatio:0.5942328422565577,loop:true,loopStart:0.006122448979591836,loopEnd:0.06349206349206349,attackEnd:0,holdEnd:0,decayEnd:0},{top:128,name:'SynthLead_C6',baseRatio:2.3760775862068964,loop:true,loopStart:0.005623582766439909,loopEnd:0.01614512471655329,attackEnd:0,holdEnd:0,decayEnd:0}],[{top:38,name:'SynthPad_A3',baseRatio:0.4999105065330231,loop:true,loopStart:0.1910204081632653,loopEnd:3.9917006802721087,attackEnd:0.05,holdEnd:0.05,decayEnd:0.05},{top:50,name:'SynthPad_A3',baseRatio:0.4999105065330231,loop:true,loopStart:0.1910204081632653,loopEnd:3.9917006802721087,attackEnd:0.08,holdEnd:0.08,decayEnd:0.08},{top:62,name:'SynthPad_A3',baseRatio:0.4999105065330231,loop:true,loopStart:0.1910204081632653,loopEnd:3.9917006802721087,attackEnd:0.11,holdEnd:0.11,decayEnd:0.11},{top:74,name:'SynthPad_A3',baseRatio:0.4999105065330231,loop:true,loopStart:0.1910204081632653,loopEnd:3.9917006802721087,attackEnd:0.15,holdEnd:0.15,decayEnd:0.15},{top:86,name:'SynthPad_A3',baseRatio:0.4999105065330231,loop:true,loopStart:0.1910204081632653,loopEnd:3.9917006802721087,attackEnd:0.2,holdEnd:0.2,decayEnd:0.2},{top:128,name:'SynthPad_C6',baseRatio:2.3820424708835755,loop:true,loopStart:0.11678004535147392,loopEnd:0.41732426303854875,attackEnd:0,holdEnd:0,decayEnd:0}]];

  /*
    copy(JSON.stringify(drums.map(function(d) {
      var decayTime = d[4] || 0;
      var baseRatio = Math.pow(2, (60 - d[1] - 69) / 12);
      if (d[2]) {
        var length = d[3] - d[2];
        baseRatio = 22050 * Math.round(length * 440 * baseRatio / 22050) / length / 440;
      }
      return {
        name: d[0],
        baseRatio: baseRatio,
        loop: !!d[2],
        loopStart: d[2] / 22050,
        loopEnd: d[3] / 22050,
        attackEnd: 0,
        holdEnd: 0,
        decayEnd: decayTime
      }
    })).replace(/"(\w+)":/g,'$1:').replace(/"/g, '\''));
  */
  var DRUMS = [{name:'SnareDrum',baseRatio:0.5946035575013605,loop:false,loopStart:null,loopEnd:null,attackEnd:0,holdEnd:0,decayEnd:0},{name:'Tom',baseRatio:0.5946035575013605,loop:false,loopStart:null,loopEnd:null,attackEnd:0,holdEnd:0,decayEnd:0},{name:'SideStick',baseRatio:0.5946035575013605,loop:false,loopStart:null,loopEnd:null,attackEnd:0,holdEnd:0,decayEnd:0},{name:'Crash',baseRatio:0.8908987181403393,loop:false,loopStart:null,loopEnd:null,attackEnd:0,holdEnd:0,decayEnd:0},{name:'HiHatOpen',baseRatio:0.9438743126816935,loop:false,loopStart:null,loopEnd:null,attackEnd:0,holdEnd:0,decayEnd:0},{name:'HiHatClosed',baseRatio:0.5946035575013605,loop:false,loopStart:null,loopEnd:null,attackEnd:0,holdEnd:0,decayEnd:0},{name:'Tambourine',baseRatio:0.5946035575013605,loop:false,loopStart:null,loopEnd:null,attackEnd:0,holdEnd:0,decayEnd:0},{name:'Clap',baseRatio:0.5946035575013605,loop:false,loopStart:null,loopEnd:null,attackEnd:0,holdEnd:0,decayEnd:0},{name:'Claves',baseRatio:0.5946035575013605,loop:false,loopStart:null,loopEnd:null,attackEnd:0,holdEnd:0,decayEnd:0},{name:'WoodBlock',baseRatio:0.7491535384383408,loop:false,loopStart:null,loopEnd:null,attackEnd:0,holdEnd:0,decayEnd:0},{name:'Cowbell',baseRatio:0.5946035575013605,loop:false,loopStart:null,loopEnd:null,attackEnd:0,holdEnd:0,decayEnd:0},{name:'Triangle',baseRatio:0.8514452780229479,loop:true,loopStart:0.7638548752834468,loopEnd:0.7825396825396825,attackEnd:0,holdEnd:0,decayEnd:2},{name:'Bongo',baseRatio:0.5297315471796477,loop:false,loopStart:null,loopEnd:null,attackEnd:0,holdEnd:0,decayEnd:0},{name:'Conga',baseRatio:0.7954545454545454,loop:true,loopStart:0.1926077097505669,loopEnd:0.20403628117913833,attackEnd:0,holdEnd:0,decayEnd:2},{name:'Cabasa',baseRatio:0.5946035575013605,loop:false,loopStart:null,loopEnd:null,attackEnd:0,holdEnd:0,decayEnd:0},{name:'GuiroLong',baseRatio:0.5946035575013605,loop:false,loopStart:null,loopEnd:null,attackEnd:0,holdEnd:0,decayEnd:0},{name:'Vibraslap',baseRatio:0.8408964152537145,loop:false,loopStart:null,loopEnd:null,attackEnd:0,holdEnd:0,decayEnd:0},{name:'Cuica',baseRatio:0.7937005259840998,loop:false,loopStart:null,loopEnd:null,attackEnd:0,holdEnd:0,decayEnd:0}];

  return {
    scopedEval: function(source) {
      return eval(source);
    }
  };

}());

P.player = (function() {
  'use strict';

  var stage;
  var frameId = null;
  var isFullScreen = false;

  var progressBar = document.querySelector('.progress-bar');
  var player = document.querySelector('.player');
  var projectLink = document.querySelector('.project-link');
  var bugLink = document.querySelector('#bug-link');

  var controls = document.querySelector('.controls');
  var flag = document.querySelector('.flag');
  var turbo = document.querySelector('.turbo');
  var pause = document.querySelector('.pause');
  var stop = document.querySelector('.stop');
  var fullScreen = document.querySelector('.full-screen');

  var error = document.querySelector('.internal-error');
  var errorBugLink = document.querySelector('#error-bug-link');

  var flagTouchTimeout;
  function flagTouchStart() {
    flagTouchTimeout = setTimeout(function() {
      turboClick();
      flagTouchTimeout = true;
    }, 500);
  }
  function turboClick() {
    stage.isTurbo = !stage.isTurbo;
    flag.title = stage.isTurbo ? 'Turbo mode enabled. Shift+click to disable.' : 'Shift+click to enable turbo mode.';
    turbo.style.display = stage.isTurbo ? 'block' : 'none';
  }
  function flagClick(e) {
    if (!stage) return;
    if (flagTouchTimeout === true) return;
    if (flagTouchTimeout) {
      clearTimeout(flagTouchTimeout);
    }
    if (e.shiftKey) {
      turboClick();
    } else {
      stage.start();
      pause.className = 'pause';
      stage.stopAll();
      stage.triggerGreenFlag();
    }
    stage.focus();
    e.preventDefault();
  }

  function pauseClick(e) {
    if (!stage) return;
    if (stage.isRunning) {
      stage.pause();
      pause.className = 'play';
    } else {
      stage.start();
      pause.className = 'pause';
    }
    stage.focus();
    e.preventDefault();
  }

  function stopClick(e) {
    if (!stage) return;
    stage.start();
    pause.className = 'pause';
    stage.stopAll();
    stage.focus();
    e.preventDefault();
  }

  function fullScreenClick(e) {
    if (e) e.preventDefault();
    if (!stage) return;
    document.documentElement.classList.toggle('fs');
    isFullScreen = !isFullScreen;
    if (!e || !e.shiftKey) {
      if (isFullScreen) {
        var el = document.documentElement;
        if (el.requestFullScreenWithKeys) {
          el.requestFullScreenWithKeys();
        } else if (el.webkitRequestFullScreen) {
          el.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.mozCancelFullScreen) {
          document.mozCancelFullScreen();
        } else if (document.webkitCancelFullScreen) {
          document.webkitCancelFullScreen();
        }
      }
    }
    if (!isFullScreen) {
      document.body.style.width =
      document.body.style.height =
      document.body.style.marginLeft =
      document.body.style.marginTop = '';
    }
    updateFullScreen();
    if (!stage.isRunning) {
      stage.draw();
    }
    stage.focus();
  }

  function exitFullScreen(e) {
    if (isFullScreen && e.keyCode === 27) {
      fullScreenClick(e);
    }
  }

  function updateFullScreen() {
    if (!stage) return;
    if (isFullScreen) {
      window.scrollTo(0, 0);
      var padding = 8;
      var w = window.innerWidth - padding * 2;
      var h = window.innerHeight - padding - controls.offsetHeight;
      w = Math.min(w, h / .75);
      h = w * .75 + controls.offsetHeight;
      document.body.style.width = w + 'px';
      document.body.style.height = h + 'px';
      document.body.style.marginLeft = (window.innerWidth - w) / 2 + 'px';
      document.body.style.marginTop = (window.innerHeight - h - padding) / 2 + 'px';
      stage.setZoom(w / 480);
    } else {
      stage.setZoom(1);
    }
  }

  function preventDefault(e) {
    e.preventDefault();
  }

  window.addEventListener('resize', updateFullScreen);

  if (P.hasTouchEvents) {
    flag.addEventListener('touchstart', flagTouchStart);
    flag.addEventListener('touchend', flagClick);
    pause.addEventListener('touchend', pauseClick);
    stop.addEventListener('touchend', stopClick);
    fullScreen.addEventListener('touchend', fullScreenClick);

    flag.addEventListener('touchstart', preventDefault);
    pause.addEventListener('touchstart', preventDefault);
    stop.addEventListener('touchstart', preventDefault);
    fullScreen.addEventListener('touchstart', preventDefault);

    document.addEventListener('touchmove', function(e) {
      if (isFullScreen) e.preventDefault();
    });
  } else {
    flag.addEventListener('click', flagClick);
    pause.addEventListener('click', pauseClick);
    stop.addEventListener('click', stopClick);
    fullScreen.addEventListener('click', fullScreenClick);
  }

  document.addEventListener("fullscreenchange", function () {
    if (isFullScreen !== document.fullscreen) fullScreenClick();
  });
  document.addEventListener("mozfullscreenchange", function () {
    if (isFullScreen !== document.mozFullScreen) fullScreenClick();
  });
  document.addEventListener("webkitfullscreenchange", function () {
    if (isFullScreen !== document.webkitIsFullScreen) fullScreenClick();
  });

  function load(id, cb, titleCallback) {
    P.player.projectId = id;
    P.player.projectURL = id ? 'https://scratch.mit.edu/projects/' + id + '/' : '';

    if (stage) stage.destroy();
    while (player.firstChild) player.removeChild(player.lastChild);
    turbo.style.display = 'none';
    error.style.display = 'none';
    pause.className = 'pause';
    progressBar.style.display = 'none';

    if (id) {
      showProgress(P.IO.loadScratchr2Project(id), cb);
      P.IO.loadScratchr2ProjectTitle(id, function(title) {
        if (titleCallback) titleCallback(P.player.projectTitle = title);
      });
    } else {
      if (titleCallback) setTimeout(function() {
        titleCallback('');
      });
    }
  }

  function showError(e) {
    error.style.display = 'block';
    errorBugLink.href = 'https://github.com/adroitwhiz/bismuth/issues/new?title=' + encodeURIComponent(P.player.projectTitle || P.player.projectURL) + '&body=' + encodeURIComponent('\n\n\n' + P.player.projectURL + '\nhttp://phosphorus.github.io/#' + P.player.projectId + '\n' + navigator.userAgent + (e.stack ? '\n\n```\n' + e.stack + '\n```' : ''));
    console.error(e.stack);
  }

  function showProgress(request, loadCallback) {
    progressBar.style.display = 'none';
    setTimeout(function() {
      progressBar.style.width = '10%';
      progressBar.className = 'progress-bar';
      progressBar.style.opacity = 1;
      progressBar.style.display = 'block';
    });
    request.onload = function(s) {
      progressBar.style.width = '100%';
      setTimeout(function() {
        progressBar.style.opacity = 0;
        setTimeout(function() {
          progressBar.style.display = 'none';
        }, 300);
      }, 100);

      var zoom = stage ? stage.zoom : 1;
      window.stage = stage = s;
      stage.start();
      stage.setZoom(zoom);

      stage.root.addEventListener('keydown', exitFullScreen);
      stage.handleError = showError;

      player.appendChild(stage.root);
      stage.focus();
      if (loadCallback) {
        loadCallback(stage);
        loadCallback = null;
      }
    };
    request.onerror = function(e) {
      progressBar.style.width = '100%';
      progressBar.className = 'progress-bar error';
      console.error(e, e.stack);
    };
    request.onprogress = function(e) {
      progressBar.style.width = (10 + e.loaded / e.total * 90) + '%';
    };
  }

  return {
    load: load,
    showProgress: showProgress
  };

}());

window.P = P;
export default P;