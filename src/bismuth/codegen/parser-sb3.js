// https://github.com/LLK/scratch-vm/pull/1031#discussion_r180599225
// "Shadow blocks" become Argument objects

const ScriptPrims = require('./script-prims');
const Block = ScriptPrims.Block;
const Script = ScriptPrims.Script;
const Argument = ScriptPrims.Argument;
const Literal = ScriptPrims.Literal;

const specMap = require('./block-data/specmap-sb3.json');

/**
 * The following constants were copied from scratch-vm
 * https://github.com/LLK/scratch-vm/blob/develop/src/serialization/sb3.js
 */

// Constants used during serialization and deserialization
// const INPUT_SAME_BLOCK_SHADOW = 1; // unobscured shadow
// const INPUT_BLOCK_NO_SHADOW = 2; // no shadow
// const INPUT_DIFF_BLOCK_SHADOW = 3; // obscured shadow
// Constants referring to 'primitive' blocks that are usually shadows,
// or in the case of variables and lists, appear quite often in projects
// math_number
const MATH_NUM_PRIMITIVE = 4; // there's no reason these constants can't collide
// math_positive_number
const POSITIVE_NUM_PRIMITIVE = 5; // with the above, but removing duplication for clarity
// math_whole_number
const WHOLE_NUM_PRIMITIVE = 6;
// math_integer
const INTEGER_NUM_PRIMITIVE = 7;
// math_angle
const ANGLE_NUM_PRIMITIVE = 8;
// colour_picker
const COLOR_PICKER_PRIMITIVE = 9;
// text
const TEXT_PRIMITIVE = 10;
// event_broadcast_menu
const BROADCAST_PRIMITIVE = 11;
// data_variable
const VAR_PRIMITIVE = 12;
// data_listcontents
const LIST_PRIMITIVE = 13;

// Maps numeric argument type constants to argument type strings.
const argumentTypeMap = new Map([
	[MATH_NUM_PRIMITIVE, 'math_number'],
	[POSITIVE_NUM_PRIMITIVE, 'math_positive_number'],
	[WHOLE_NUM_PRIMITIVE, 'math_whole_number'],
	[INTEGER_NUM_PRIMITIVE, 'math_integer'],
	[ANGLE_NUM_PRIMITIVE, 'math_angle'],
	[COLOR_PICKER_PRIMITIVE, 'colour_picker'],
	[TEXT_PRIMITIVE, 'text'],
	[BROADCAST_PRIMITIVE, 'event_broadcast_menu'],
	[VAR_PRIMITIVE, 'data_variable'],
	[LIST_PRIMITIVE, 'data_listcontents']
]);

// Scratch 3 stores all block arguments as blocks themselves.
// The arguments above are serialized as 'primitives' and parsed as them,
// but the following should also be parsed as primitives.
// The corresponding field names are where these "primitive" blocks store their values.
const primitiveFieldNames = {
	'motion_pointtowards_menu': 'TOWARDS',
	'motion_goto_menu': 'TO',
	'motion_glideto_menu': 'TO',
	'looks_costume': 'COSTUME',
	'looks_backdrops': 'BACKDROP',
	'sound_sounds_menu': 'SOUND_MENU',
	'event_broadcast_menu': 'BROADCAST_OPTION',
	'control_create_clone_of_menu': 'CLONE_OPTION',
	'sensing_touchingobjectmenu': 'TOUCHINGOBJECTMENU',
	'sensing_distancetomenu': 'DISTANCETOMENU',
	'sensing_of_object_menu': 'OBJECT',
	'sensing_keyoptions': 'KEY_OPTION',
	'note': 'NOTE'
	// TODO: data_listindex arguments?
};

const primitiveArguments = new Set(Object.keys(primitiveFieldNames));

// Shadows take the form [shadow obscured state, [primitive type, value], obscured value (if present)]

class SB3Parser {
	constructor () {
		this.blocks = null;
	}

	// Parse the entire 'blocks' section of a sprite at once.
	// In .sb3 manifests, there's no division of blocks between 'scripts'.
	parseBlocks (blocks) {
		this.blocks = blocks;
		// Splitting blocks into scripts is done by first getting all 'top level' blocks,
		// which are at the top of the 'stack', then walking downwards from there.
		// Shadow blocks don't count.
		const topLevelBlocks = Object.values(blocks).filter(block => block.topLevel && !block.shadow);

		const scripts = [];

		for (const block of topLevelBlocks) {
			scripts.push(this.parseStack(block));
		}

		return scripts;
	}

	// Parse a 'stack' of blocks into a Script, given the block that starts the stack.
	parseStack (startingBlock) {
		const script = new Script();

		let nextBlock = startingBlock;

		while (nextBlock !== undefined) {
			script.addBlock(this.parseBlock(nextBlock));
			nextBlock = this.blocks[nextBlock.next];
		}

		return script;
	}

	// Parse an individual block.
	parseBlock (block) {
		// The block is a "primitive", and we should return a Literal.
		if (primitiveArguments.has(block.opcode)) {
			// TODO: see parseField
			// Returning field[0] is probably incorrect
			return new Literal(block.opcode, block.fields[primitiveFieldNames[block.opcode]][0]);
		}

		const parsedArgs = {};

		switch (block.opcode) {
			case 'procedures_definition': {
				// oi janky hack m8
				const procPrototype = this.blocks[block.inputs['custom_block'][1]];

				const argMap = {};

				const argNames = JSON.parse(procPrototype.mutation.argumentnames);
				const argIDs = JSON.parse(procPrototype.mutation.argumentids);

				for (let i = 0; i < argNames.length; i++) {
					argMap[argNames[i]] = argIDs[i];
				}

				parsedArgs.PROCEDURE = new Argument(
					'PROCEDURE',
					'field',
					new Literal('field', procPrototype.mutation.proccode)
				);

				parsedArgs.ARGUMENTS = new Argument(
					'ARGUMENTS',
					'procedure_arguments_map',
					new Literal('procedure_arguments_map', argMap)
				);

				parsedArgs.WARP_MODE = new Argument(
					'WARP_MODE',
					'boolean',
					// the Boolean() constructor doesn't cast strings such as "true" and "false"
					new Literal('boolean', procPrototype.mutation.warp === 'true')
				);

				break;
			}
			case 'procedures_call': {
				const args = {};

				parsedArgs.PROCEDURE = new Argument(
					'PROCEDURE',
					'field',
					new Literal('field', block.mutation.proccode)
				);
				parsedArgs.ARGUMENTS = new Argument(
					'ARGUMENTS',
					'procedure_arguments',
					new Literal('procedure_arguments', args)
				);

				// In some cases, deleted procedure arguments are still around in the block's `inputs`.
				// Instead, use `argumentids`.
				const argIDs = JSON.parse(block.mutation.argumentids);
				for (const argName of argIDs) {
					args[argName] = this.parseInput(block, argName);
				}

				break;
			}
			default: {
				for (const argName of Object.keys(block.inputs)) {
					parsedArgs[argName] = this.parseInput(block, argName);
				}

				// For booleans and substacks, non-plugged inputs are not serialized.
				// Substacks are handled in parseInput, but booleans aren't even added to the argument list.
				// Use the specmap to tell whether the block is missing any arguments, and if so,
				// fill them in with the default boolean value (false).
				if (specMap.hasOwnProperty(block.opcode)) {
					for (const argName of Object.keys(specMap[block.opcode])) {
						if (!parsedArgs.hasOwnProperty(argName)) {
							parsedArgs[argName] = new Argument(argName, 'boolean', new Literal('boolean', false));
						}
					}
				}

				for (const argName of Object.keys(block.fields)) {
					parsedArgs[argName] = new Argument(argName, 'field', this.parseField(block, argName));
				}

				break;
			}
		}

		return new Block(block.opcode, parsedArgs);
	}

	// Parses a block argument input.
	parseInput (block, argName) {
		const input = block.inputs[argName];

		// Non-dropped boolean values do not hold a value. As far as I know, they're the only values with this behavior
		// so it's safe to return "false", the default value of an empty boolean.
		if (!input) return new Argument(argName, 'boolean', new Literal('boolean', false));

		if (input[1] instanceof Array) {
			// Input is a compressed block. These are usually "shadow blocks" but can also be "get variable/list".
			const shadow = input[1];
			const argValueType = argumentTypeMap.get(shadow[0]);

			let argValue;

			// These aren't really primitives. The rest of the "shadow blocks" are, though.
			switch (argValueType) {
				case 'data_variable': {
					argValue = new Block('data_variable', {
						VARIABLE: new Argument(
							'VARIABLE',
							'field',
							new Literal('field', shadow[1])
						)
					});

					break;
				}
				case 'data_listcontents': {
					argValue = new Block('data_listcontents', {
						LIST: new Argument(
							'LIST',
							'field',
							new Literal('field', shadow[1])
						)
					});

					break;
				}
				default: {
					argValue = new Literal(argValueType, shadow[1]);
					break;
				}
			}

			let argType = 'text';
			if (specMap.hasOwnProperty(block.opcode)) argType = specMap[block.opcode][argName];

			return new Argument(argName, argType, argValue);
		} else {
			// Input is a UID of a regular block.
			const blockUID = input[1];

			// TODO: this is a bit of a hack.
			// It may be better to detect substacks by seeing if the input block has a 'next' block.
			let parsedInput;
			if (argName === 'SUBSTACK' || argName === 'SUBSTACK2') {
				// If there's no substack, return an empty script so the compiler doesn't choke
				if (blockUID === null) {
					parsedInput = new Script();
				} else {
					parsedInput = this.parseStack(this.blocks[blockUID]);
				}
			} else {
				parsedInput = this.parseBlock(this.blocks[blockUID]);
			}

			const blockSpec = specMap[block.opcode];

			return new Argument(
				argName,
				blockSpec ? blockSpec[argName] : 'auto',
				parsedInput
			);
		}
	}

	// Parses a block field.
	// TODO: this is currently complete guesswork because I don't feel like learning how fields are serialized.
	parseField (block, argName) {
		return new Literal(
			'field',
			block.fields[argName][0]
		);
	}
}

module.exports = SB3Parser;
