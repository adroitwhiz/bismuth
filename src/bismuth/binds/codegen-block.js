var LOG_PRIMITIVES = false;
var DEBUG = false;

var visual = 0;
var compile = function(object, block, fns, startingPosition, inputs, types, used) {
	var nextLabel = function() {
		return object.fns.length + fns.length;
	};
	
	var label = function() {
		var id = nextLabel();
		fns.push(source.length + startingPosition);
		console.log(fns);
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
			source += compile(object, script[i], fns, source.length + startingPosition);
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

	const val2Table = {
		'costumeName': e => 'S.getCostumeName()',
		'sceneName': e => 'self.getCostumeName()',
		'readVariable': e => varRef(e[1]),
		'contentsOfList:': e => `contentsOfList(${listRef(e[1])})`,
		'getLine:ofList:': e => `getLineOfList(${listRef(e[2])}, ${val(e[1])})`,
		'concatenate:with:':e => `("" + ${val(e[1])} + ${val(e[2])})`,
		'letter:of:': e => `(("" + ${val(e[2])})[(${num(e[1])} | 0) - 1] || "")`,
		'answer': e => 'self.answer',
		'getAttribute:of:': e => `attribute(${val(e[1])}, ${val(e[2])})`,
		'getUserId': e => '0',
		'getUserName': e => '""'
	}
	
	var val2 = function(e) {
		return val2Table[e[0]](e);
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
	
		if (e[0] === 'xpos') {
			/* Motion */
	
			return 'S.scratchX';
	
		} else if (e[0] === 'ypos') {
	
			return 'S.scratchY';
	
		} else if (e[0] === 'heading') {
	
			return 'S.direction';
	
		} else if (e[0] === 'costumeIndex') {
			/* Looks */
	
			return '(S.currentCostumeIndex + 1)';
	
		} else if (e[0] === 'backgroundIndex') {
	
			return '(self.currentCostumeIndex + 1)';
	
		} else if (e[0] === 'scale') {
	
			return '(S.scale * 100)';
	
		} else if (e[0] === 'volume') {
			/* Sound */
	
			return '(S.volume * 100)';
	
		} else if (e[0] === 'tempo') {
	
			return 'self.tempoBPM';
	
		} else if (e[0] === 'lineCountOfList:') {
			/* Data */
	
			return listRef(e[1]) + '.length';
	
		} else if (e[0] === '+') {
			/* Operators */
	
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
	
		} else if (e[0] === 'mouseX') {
			/* Sensing */
	
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
	
		if (e[0] === 'list:contains:') {
			/* Data */
	
			return 'listContains(' + listRef(e[1]) + ', ' + val(e[2]) + ')';
	
		} else if (e[0] === '<' || e[0] === '>') {
			/* Operators */
	
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
	
		} else if (e[0] === 'mousePressed') {
			/* Sensing */
	
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

	var source = '';

	if (LOG_PRIMITIVES) {
		source += 'console.log(' + val(block[0]) + ');\n';
	}

	if (['turnRight:', 'turnLeft:', 'heading:', 'pointTowards:', 'setRotationStyle', 'lookLike:', 'nextCostume', 'say:duration:elapsed:from:', 'say:', 'think:duration:elapsed:from:', 'think:', 'changeGraphicEffect:by:', 'setGraphicEffect:to:', 'filterReset', 'changeSizeBy:', 'setSizeTo:', 'comeToFront', 'goBackByLayers:'].indexOf(block[0]) !== -1) {
		if (visual < 1) {
			source += 'if (S.visible) VISUAL = true;\n';
			visual = 1;
		} else if (DEBUG) source += '/* visual: 2 */\n';
	} else if (['forward:', 'gotoX:y:', 'gotoSpriteOrMouse:', 'changeXposBy:', 'xpos:', 'changeYposBy:', 'ypos:', 'bounceOffEdge', 'glideSecs:toX:y:elapsed:from:'].indexOf(block[0]) !== -1) {
		if (visual < 2) {
			source += 'if (S.visible || S.isPenDown) VISUAL = true;\n';
			visual = 2;
		} else if (DEBUG) source += '/* visual: 1 */\n';
	} else if (['showBackground:', 'startScene', 'nextBackground', 'nextScene', 'startSceneAndWait', 'show', 'hide', 'putPenDown', 'stampCostume', 'showVariable:', 'hideVariable:', 'doAsk', 'setVolumeTo:', 'changeVolumeBy:', 'setTempoTo:', 'changeTempoBy:'].indexOf(block[0]) !== -1) {
		if (visual < 3) {
			source += 'VISUAL = true;\n';
			visual = 3;
		} else if (DEBUG) source += '/* visual: 3 */\n';
	}

	if (block[0] === 'forward:') {
		/* Motion */

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

	} else if (block[0] === 'lookLike:') {
		/* Looks */

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

	} else if (block[0] === 'playSound:') {
		/* Sound */

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

	} else if (block[0] === 'clearPenTrails') {
		/* Pen */

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

	} else if (block[0] === 'setVar:to:') {
		/* Data */

		source += varRef(block[1]) + ' = ' + val(block[2]) + ';\n';

	} else if (block[0] === 'changeVar:by:') {

		var ref = varRef(block[1]);
		source += ref + ' = (+' + ref + ' || 0) + ' + num(block[2]) + ';\n';

	} else if (block[0] === 'append:toList:') {

		source += 'appendToList(' + listRef(block[2]) + ', ' + val(block[1]) + ');\n';

	} else if (block[0] === 'deleteLine:ofList:') {

		source += 'deleteLineOfList(' + listRef(block[2]) + ', ' + val(block[1]) + ');\n';

	} else if (block[0] === 'insert:at:ofList:') {

		source += 'insertInList(' + listRef(block[3]) + ', ' + val(block[2]) + ', ' + val(block[1]) + ');\n';

	} else if (block[0] === 'setLine:ofList:to:') {

		source += 'setLineOfList(' + listRef(block[2]) + ', ' + val(block[1]) + ', ' + val(block[3]) + ');\n';

	} else if (block[0] === 'showVariable:' || block[0] === 'hideVariable:') {

		var isShow = block[0] === 'showVariable:';
		if (typeof block[1] !== 'string') {
			throw new Error('Dynamic variables are not supported');
		}
		var o = object.vars[block[1]] !== undefined ? 'S' : 'self';
		source += o + '.showVariable(' + val(block[1]) + ', ' + isShow + ');\n';

		// } else if (block[0] === 'showList:') {

		// } else if (block[0] === 'hideList:') {

	} else if (block[0] === 'broadcast:') {
		/* Control */

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

	} else if (block[0] === 'doAsk') {
		/* Sensing */

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

		console.warn('Undefined command: ' + block[0]);

	}

	return source;
};

module.exports = compile;
