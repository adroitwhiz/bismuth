const ScriptPrims = require('./script-prims');
const Block = ScriptPrims.Block;
const Script = ScriptPrims.Script;
const Literal = ScriptPrims.Literal; //i could order these in order of increasing scope... or i could keep them arranged by length
const FieldAccessor = ScriptPrims.FieldAccessor;

const specMap = require('./specmap');

class Parser {
	constructor() {

	}

	// Parses a 2.0 script
	parseScript(script) {
		const generatedScript = new Script();
		for (let i = 0; i < script.length; i++) {
			generatedScript.addBlock(this.parseBlock(script[i]));
		}

		return generatedScript;
	}

	// Parses a 2.0 block
	parseBlock(block) {
		const blockOpcode = block[0];
		const blockArgs = block.slice(1);

		const parsedOpcode = specMap[blockOpcode].opcode;

		if (!parsedOpcode) {
			console.warn(`Unknown opcode ${blockOpcode}`);
			return new Block('unknown_opcode', []);
		}

		const parsedArgs = {};

		if (parsedOpcode === 'procedures_definition') { // The one block that works differently...
			const argTypes = blockArgs[0]
				.split(/(?=[^\\]%[nbs])/) // split argument string (e. g. "say text %s in %n seconds") by percent sign; this gives us ["say text", " %s in", " %n seconds"]
				.map(arg => arg.trim().substr(0,2)) // trim whitespace and take first two characters only (now ["sa", "%s", "%n"])
				.filter(arg => arg.substr(0, 1) === '%'); // filter by percent sign to get argument types only (["%s", "%n"]) and we're done
			
			const argNames = blockArgs[1];

			for (let i = 0; i < argTypes.length; i++) {
				parsedArgs.push(new FieldAccessor('ARGUMENT', argNames[i])); //TODO: make this actually work
			}

			//TODO: implement warp-speed
		} else if (parsedOpcode === 'procedures_call') { /// The *other* block that works differently...
			parsedArgs.push(new FieldAccessor('PROCEDURE', blockArgs[0]));
			for (let i = 1; i < blockArgs.length; i++) {
				parsedArgs.push(this.parseArgument(blockArgs, block[0], i, {type: 'input', inputOp: 'auto'})); //TODO: make this actually work
			}
		} else {
			for (let i = 0; i < blockArgs.length; i++) {
				const parsedArg = this.parseArgument(blockArgs, block[0], i);
				if (parsedArg) parsedArgs[parsedArg.name] = parsedArg;
			}
		}

		return new Block(parsedOpcode, parsedArgs);
	}

	// Parses an argument passed to a 2.0 block
	parseArgument(blockArgs, blockOpcode, argIndex, mappedBlockArg) {
		const arg = blockArgs[argIndex];

		if (!mappedBlockArg) mappedBlockArg = specMap[blockOpcode].argMap[argIndex];

		if (!mappedBlockArg) return null;

		let parsedArgument;

		if (mappedBlockArg.type === 'input' && mappedBlockArg.inputOp === 'substack') {
			if (arg === null) {
				parsedArgument = new Script();
			} else {
				parsedArgument = this.parseScript(arg);
			}
		} else if (Array.isArray(arg)) {
			parsedArgument = this.parseBlock(arg);
		} else {
			parsedArgument = new Literal(mappedBlockArg.inputOp || 'field', arg);
		}

		return {name: mappedBlockArg[`${mappedBlockArg.type}Name`], value: parsedArgument, type: mappedBlockArg.inputOp || 'field'};
	}
}

module.exports = Parser;