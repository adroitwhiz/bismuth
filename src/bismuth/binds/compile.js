const CodeGenerator = require('../codegen/code-generator');
const Parser = require('../codegen/parser');
const generateJavascriptCode = require('../codegen/emit-javascript');
const getKeyCode = require('../util/get-key-code');

const compile = (P => {
	const EVENT_SELECTOR_MAP = {
		'event_whenflagclicked': 'whenGreenFlag',
		'event_whenthisspriteclicked': 'whenClicked',
		'control_start_as_clone': 'whenCloned',
		'event_whenkeypressed': 'whenKeyPressed',
		'event_whenbackdropswitchesto': 'whenSceneStarts',
		'event_whenbroadcastreceived': 'whenIReceive'
	};

	const compileScripts = object => {
		// Part 1: Parse all scripts
		const parser = new Parser();
		const generator = new CodeGenerator(object);

		const parsedScripts = [];
		for (let i = 0; i < object.scripts.length; i++) {
			parsedScripts.push(parser.parseScript(object.scripts[i][2]));
		}

		// console.log(parsedScripts);

		// Part 2: Compile the scripts into their JS AST representations,
		// adding to the object's array of continuation functions (in AST form)
		const compiledScripts = [];
		for (let i = 0; i < parsedScripts.length; i++) {
			compiledScripts.push(generator.compileScript(parsedScripts[i]));
		}

		// Part 3: For every continuation function AST in the object,
		// stringify it into JS code, then eval() it, compiling it into *actual* JS.
		for (let i = 0; i < object.continuations.length; i++) {
			object.fns.push(P.runtime.scopedEval(generateJavascriptCode(generator, object.continuations[i])));

			// console.log(i, generateJavascriptCode(generator, object.continuations[i]));
		}

		// console.log(compiledScripts);
		// console.log(object);

		//Part 4: For every compiled script, add a listener
		for (let i = 0; i < compiledScripts.length; i++) {
			addListener(object, compiledScripts[i]);
		}
	};

	const addListener = (object, script) => {
		const listenerFunction = object.fns[script.continuationID];

		switch (script.listenerBlock.opcode) {
			// For simple events, just add 'em to the object's list of listeners
			case 'event_whenflagclicked':
			case 'event_whenthisspriteclicked':
			case 'control_start_as_clone': {
				object.listeners[EVENT_SELECTOR_MAP[script.listenerBlock.opcode]].push(listenerFunction);
				break;
			}
			// For "when key pressed", special-case "any" key; otherwise
			// add to the object's list of listeners for the specific key pressed
			case 'event_whenkeypressed': {
				const keyField = script.listenerBlock.args.KEY_OPTION.value.value;
				if (keyField === 'any') {
					for (let i = 128; i > 0; i--) {
						object.listeners.whenKeyPressed[i].push(listenerFunction);
					}
				} else {
					object.listeners.whenKeyPressed[getKeyCode(keyField)].push(listenerFunction);
				}
				break;
			}
			// For "when broadcast received" and "when backdrop switches to",
			// which take identifiers in the form of strings, lowercase the identifiers
			// and then add them to the object's map of broadcast or backdrop listeners
			case 'event_whenbackdropswitchesto':
			case 'event_whenbroadcastreceived': {
				const eventName = (
					script.listenerBlock.args.BROADCAST_OPTION ||
					script.listenerBlock.args.BACKDROP).value.value.toLowerCase();
				
				const listenerName = EVENT_SELECTOR_MAP[script.listenerBlock.opcode];

				(object.listeners[listenerName][eventName] ||
				(object.listeners[listenerName][eventName] = [])).push(listenerFunction);
				break;
			}
			case 'procedures_definition': {
				const blockArgs = script.listenerBlock.args;
				object.procedures[blockArgs['PROCEDURE'].value.value] = {
					inputs: blockArgs['ARGUMENTS'].value.value,
					warp: blockArgs['WARP_MODE'].value.value,
					fn: listenerFunction
				};
				break;
			}
			// Oopsie woopsie
			default: {
				// TODO: only log this for truly unknown blocks
				// console.warn(`Unknown hat block ${script.listenerBlock.opcode}`);
			}
		}
	};

	return stage => {
		compileScripts(stage);

		for (let i = 0; i < stage.children.length; i++) {
			compileScripts(stage.children[i]);
		}

	};
});

module.exports = compile;
