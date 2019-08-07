const CodeGenerator = require('../codegen/code-generator');
const Parser = require('../codegen/parser.js');

var compile = (function (P) {
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

	var compileScripts = function (object) {
		const parser = new Parser();
		const generator = new CodeGenerator(object);

		const parsedScripts = [];
		for (let i = 0; i < object.scripts.length; i++) {
			parsedScripts.push(parser.parseScript(object.scripts[i][2]));
			//compileListener(object, object.scripts[i][2]);
		}

		const compiledScripts = [];
		for (let i = 0; i < parsedScripts.length; i++) {
			compiledScripts.push(generator.compileScript(parsedScripts[i]));
		}
	};

	var warnings;
	var warn = function (message) {
		warnings[message] = (warnings[message] || 0) + 1;
	};

	var compileListener = function (object, script) {
		const generator = new CodeGenerator();

		// Skip compilation if the script is empty or not connected to a hat block
		if (!script[0] || EVENT_SELECTORS.indexOf(script[0][0]) === -1) return;

		var source = '';
		var nextFunctionID = object.fns.length;
		var functions = [0];

		const firstBlock = script[0];

		/*if (firstBlock[0] === 'procDef') {
			var inputs = script[0][2];
			var types = script[0][1].match(/%[snmdcb]/g) || [];
			var used = [];
		}*/

		//const compiledScript = generator.compile(object, script);
		//console.log(compiledScript);

		const parsedScript = new Parser().parseScript(script);

		const compiledScript = new CodeGenerator().compileScript(parsedScript);

		console.log(compiledScript);

		/*for (var i = 1; i < script.length; i++) {
			//source += compile(object, script[i], fns, source.length, inputs, types, used);
			console.log(script[i]);
		}*/

		/*if (firstBlock[0] === 'procDef') {
			var pre = '';
			for (var i = types.length; i--;)
				if (used[i]) {
					var t = types[i];
					if (t === '%d' || t === '%n' || t === '%c') {
						pre += 'C.numargs[' + i + '] = +C.args[' + i + '] || 0;\n';
					} else if (t === '%b') {
						pre += 'C.boolargs[' + i + '] = bool(C.args[' + i + ']);\n';
					}
				}
			source = pre + source;
			for (var i = 1, l = functions.length; i < l; ++i) {
				functions[i] += pre.length;
			}
			source += 'endCall();\n';
			source += 'return;\n';

		}*/

		/*var createContinuation = function(source) {
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

		for (var i = 0; i < functions.length; i++) {
			object.fns.push(createContinuation(source.slice(functions[i])));
		}*/

		var f = object.fns[nextFunctionID];

		var key;
		if (firstBlock[0] === 'whenClicked') {
			object.listeners.whenClicked.push(f);
		} else if (firstBlock[0] === 'whenGreenFlag') {
			object.listeners.whenGreenFlag.push(f);
		} else if (firstBlock[0] === 'whenCloned') {
			object.listeners.whenCloned.push(f);
		} else if (firstBlock[0] === 'whenIReceive') {
			key = firstBlock[1].toLowerCase();
			(object.listeners.whenIReceive[key] || (object.listeners.whenIReceive[key] = [])).push(f);
		} else if (firstBlock[0] === 'whenKeyPressed') {
			if (firstBlock[1] === 'any') {
				for (var i = 128; i--;) {
					object.listeners.whenKeyPressed[i].push(f);
				}
			} else {
				object.listeners.whenKeyPressed[P.getKeyCode(firstBlock[1])].push(f);
			}
		} else if (firstBlock[0] === 'whenSceneStarts') {
			key = firstBlock[1].toLowerCase();
			(object.listeners.whenSceneStarts[key] || (object.listeners.whenSceneStarts[key] = [])).push(f);
		} else if (firstBlock[0] === 'procDef') {
			object.procedures[firstBlock[1]] = {
				inputs: inputs,
				warp: firstBlock[4],
				fn: f
			};
		} else {
			warn('Undefined event: ' + firstBlock[0]);
		}
	};

	return function (stage) {

		warnings = Object.create(null);

		compileScripts(stage);

		for (var i = 0; i < stage.children.length; i++) {
			compileScripts(stage.children[i]);
		}

		for (var key in warnings) {
			console.warn(key + (warnings[key] > 1 ? ' (repeated ' + warnings[key] + ' times)' : ''));
		}

	};
});

module.exports = compile;
