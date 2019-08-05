const astring = require("astring");
const e = require("estree-builder");

const ScriptPrims = require("./script-prims");
const CompiledScript = require("./listener-script");
const BlockTranslators = require("./block-translators");
const VisibilityState = require("./visibility-state");
const Builders = require("./es-builders");

class CodeGenerator {
	/**
	 * The code generator.
	 */
	constructor(object) {
		this.object = object;

		this.translators = BlockTranslators(this);
	}

	castValue(value, type) { //TODO: make this work more
		if (type === (
			"math_number" ||
			"math_integer" ||
			"math_whole_number" ||
			"math_positive_number" ||
			"math_angle")) { // numeric types
			
			let castedValue = e["||"](e["+"](value), e["number"](0)); // cast to number with unary plus, OR with zero if that fails

			if (type === (
				"math_integer" ||
				"math_whole_number")) { 
				
				// ROUND number types
				// call Math.round. Bitwise optimization trickery will cause numbers greater than 2^31 - 1 to do strange things
				castedValue = e["call"](e["."](e["id"]("Math"), e["id"]("round")), [castedValue]);
			}

			if (type === "math_positive_number") {
				// POSITIVE number types
				// call Math.max(this number, 0)
				castedValue = e["call"](e["."](e["id"]("Math"), e["id"]("max")), [castedValue, e["num"](0)]);
			}

			return castedValue;
		}

		return value;
	}

	getInput(input) {
		let inputNode;
		if (input.value instanceof ScriptPrims.Literal) {
			inputNode = {type: "Literal", value: input.value.value};
		} else if (input.value instanceof ScriptPrims.Script) {
			inputNode = e["block"](this.compileSubstack(input.value));
		} else {
			inputNode = this.compileBlock(input.value);
		}

		return this.castValue(inputNode, input.type);
	}

	makeFunction(expr) {
		return {type:"ExpressionStatement", expression:e["function"]([], expr, null)};
	}

	getNextContinuationID() {
		return this.object.continuations.length;
	}

	pushContinuation(continuation) {
		let continuationID = this.getNextContinuationID();
		this.object.continuations.push(continuation);
		return continuationID;
	}

	continue(substack) {
		return this.pushContinuation(this.compileFunction(substack));
	}

	compileBlock(block, index, script) {
		if (this.translators.hasOwnProperty(block.opcode)) {
			return this.translators[block.opcode](block, index, script);
		} else {
			console.warn(`Unknown opcode ${block.opcode}`);
		}
	}

	compileSubstack(substack) {
		const compiledInstructions = [];

		// As explained in visibility-state.js, the VISUAL flag is set
		// when certain blocks do certain things.
		// We should only need to set VISUAL the first time a
		// visibility-affecting block appears, but because
		// some blocks require more conditions to be met for VISUAL
		// to be set, we must check whether the current block requires
		// fewer conditions than the last visibility-affecting one,
		// and if so, add another check.
		let currentVisibilityScope = VisibilityState.VisibilityScope.DOES_NOT_AFFECT_VISUAL;

		for (let instructionIndex = 0; instructionIndex < substack.blocks.length; instructionIndex++) {
			const currentBlock = substack.blocks[instructionIndex];

			if (VisibilityState.visibilityBlockScopes[currentBlock.opcode] > currentVisibilityScope) {
				currentVisibilityScope = VisibilityState.visibilityBlockScopes[currentBlock.opcode];
				compiledInstructions.push(Builders.setVisualForScope(VisibilityState.visibilityBlockScopes[currentBlock.opcode]));
			}

			compiledInstructions.push(this.compileBlock(currentBlock, instructionIndex, substack));
		}

		return compiledInstructions;
	}

	compileFunction(substack) {
		return this.makeFunction(this.compileSubstack(substack));
	}

	compileScript(script) {
		return new CompiledScript(script.blocks[0], this.continue(script.shifted));
	}
}

module.exports = CodeGenerator;