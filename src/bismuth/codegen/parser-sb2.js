const ScriptPrims = require('./script-prims');
const Block = ScriptPrims.Block;
const Script = ScriptPrims.Script;
const Argument = ScriptPrims.Argument;
const Literal = ScriptPrims.Literal;

const specMap = require('./block-data/specmap-sb2');

class SB2Parser {
	constructor () {

	}

	parseScript (script) {
		return this.parseStack(script[2]);
	}

	// Parses a 2.0 script
	parseStack (script) {
		const generatedScript = new Script();
		for (let i = 0; i < script.length; i++) {
			generatedScript.addBlock(this.parseBlock(script[i]));
		}

		return generatedScript;
	}

	// Parses a 2.0 block
	parseBlock (block) {
		const blockOpcode = block[0];
		const blockArgs = block.slice(1);

		const mappedBlock = specMap[blockOpcode];
		let parsedOpcode;

		if (mappedBlock) {
			parsedOpcode = mappedBlock.opcode;
		} else {
			console.warn(`Unknown opcode ${blockOpcode}`);
			return new Block('unknown_opcode', {});
		}

		const parsedArgs = {};

		switch (parsedOpcode) {
			case 'procedures_definition': {
				const argTypes = blockArgs[0]
					// split argument string (e. g. "say text %s in %n seconds") by percent sign;
					// this gives us ["say text", " %s in", " %n seconds"]
					.split(/(?=[^\\]%[nbs])/)
					// trim whitespace and take first two characters only (now ["sa", "%s", "%n"])
					.map(arg => arg.trim().substr(0, 2))
					// filter by percent sign to get argument types only (["%s", "%n"]) and we're done
					.filter(arg => arg.substr(0, 1) === '%');

				const argNames = blockArgs[1];

				const argMap = {};

				// Scratch 2.0 doesn't give us named arguments in procedure calls, so follow scratch-vm's behavior
				// and make them 'input0', 'input1', etc.
				for (let i = 0; i < argTypes.length; i++) {
					argMap[argNames[i]] = `input${i}`;
				}

				parsedArgs.PROCEDURE = new Argument(
					'PROCEDURE',
					'field',
					new Literal('field', blockArgs[0])
				);

				parsedArgs.ARGUMENTS = new Argument(
					'ARGUMENTS',
					'procedure_arguments_map',
					new Literal('procedure_arguments_map', argMap)
				);

				parsedArgs.WARP_MODE = new Argument(
					'WARP_MODE',
					'boolean',
					new Literal('boolean', blockArgs[3])
				);

				break;
			}
			case 'procedures_call': {
				const args = {};

				parsedArgs.PROCEDURE = new Argument(
					'PROCEDURE',
					'field',
					new Literal('field', blockArgs[0])
				);
				parsedArgs.ARGUMENTS = new Argument(
					'ARGUMENTS',
					'procedure_arguments',
					new Literal('procedure_arguments', args)
				);
				for (let i = 1; i < blockArgs.length; i++) {
					// TODO: change 'auto' type to whatever the arg type is
					// Scratch 2.0 doesn't give us named arguments in procedure calls, so follow scratch-vm's behavior
					// and make them 'input0', 'input1', etc.
					args[`input${i - 1}`] = this.parseArgument(
						blockArgs,
						block[0],
						i,
						{type: 'input', inputOp: 'auto', inputName: `input${i - 1}`}
					);
				}

				break;
			}
			default: {
				for (let i = 0; i < blockArgs.length; i++) {
					const parsedArg = this.parseArgument(blockArgs, block[0], i);
					if (parsedArg) parsedArgs[parsedArg.name] = parsedArg;
				}

				break;
			}
		}

		// 'getParam' maps to two different opcodes depending on its type (bool, string, number),
		// which is given as the second argument. 'b' for 'boolean' maps to 'argument_reporter_boolean',
		// all others map to 'argument_reporter_string_number'.
		if (parsedOpcode === 'argument_reporter_string_number' && blockArgs[1] === 'b') {
			parsedOpcode = 'argument_reporter_boolean';
		}

		// 'item of list, 'insert at list', 'delete of list', and 'replace item of list' can have non-numeric indices.
		// If the 'INDEX' parameter cannot be directly coerced into a number, change its type to 'text'.
		if ((parsedOpcode === 'data_insertatlist' ||
			parsedOpcode === 'data_replaceitemoflist' ||
			parsedOpcode === 'data_deleteoflist' ||
			parsedOpcode === 'data_itemoflist') &&
			Number.isNaN(Number(parsedArgs['INDEX'].value.value))) {

			parsedArgs['INDEX'].type = 'text';
			parsedArgs['INDEX'].value.type = 'text';
		}

		// Handle blocks that have been given menus in 3.0
		// Adapted from https://github.com/LLK/scratch-vm/blob/0a5673d5/src/serialization/sb2.js#L1179
		switch (blockOpcode) {
			case 'comeToFront':
				parsedArgs.FRONT_BACK = {
					name: 'FRONT_BACK',
					value: new Literal('field', 'front'),
					type: 'field'
				};
				break;
			case 'goBackByLayers:':
				parsedArgs.FORWARD_BACKWARD = {
					name: 'FORWARD_BACKWARD',
					value: new Literal('field', 'backward'),
					type: 'field'
				};
				break;
			case 'backgroundIndex':
				parsedArgs.NUMBER_NAME = {
					name: 'NUMBER_NAME',
					value: new Literal('field', 'number'),
					type: 'field'
				};
				break;
			case 'sceneName':
				parsedArgs.NUMBER_NAME = {
					name: 'NUMBER_NAME',
					value: new Literal('field', 'name'),
					type: 'field'
				};
				break;
			case 'costumeIndex':
				parsedArgs.NUMBER_NAME = {
					name: 'NUMBER_NAME',
					value: new Literal('field', 'number'),
					type: 'field'
				};
				break;
			case 'costumeName':
				parsedArgs.NUMBER_NAME = {
					name: 'NUMBER_NAME',
					value: new Literal('field', 'name'),
					type: 'field'
				};
				break;
		}

		return new Block(parsedOpcode, parsedArgs);
	}

	// Parses an argument passed to a 2.0 block
	parseArgument (blockArgs, blockOpcode, argIndex, mappedBlockArg) {
		const arg = blockArgs[argIndex];

		if (!mappedBlockArg) mappedBlockArg = specMap[blockOpcode].argMap[argIndex];

		if (!mappedBlockArg) return null;

		let parsedArgument;

		if (mappedBlockArg.type === 'input' && mappedBlockArg.inputOp === 'substack') {
			if (arg === null) {
				parsedArgument = new Script();
			} else {
				parsedArgument = this.parseStack(arg);
			}
		} else if (Array.isArray(arg)) {
			parsedArgument = this.parseBlock(arg);
		} else {
			parsedArgument = new Literal(mappedBlockArg.inputOp || 'field', arg);
		}

		return new Argument(
			mappedBlockArg[`${mappedBlockArg.type}Name`],
			mappedBlockArg.inputOp || 'field',
			parsedArgument
		);
	}
}

module.exports = SB2Parser;
