const e = require('estree-builder');

const ScriptPrims = require('./script-prims');
const CompiledScript = require('./listener-script');
const BlockTranslators = require('./block-translators');
const GeneratorCommon = require('./generator-common');
const VisibilityState = require('./visibility-state');
const Builders = require('./es-builders');

class CodeGenerator {
	/**
	 * The code generator.
	 */
	constructor (object) {
		this.object = object;

		this.returnStack = [];

		// Bind the two actual code generator objects to this generator.
		// "translators" is a collection of functions that takes blocks and returns AST code.
		// "commonGenerators" is a collection of functions that returns AST code for common operations.
		this.translators = BlockTranslators(this);
		this.commonGenerators = GeneratorCommon(this);

		this._backpatchIDCounter = 0;
		this.backpatchMap = {};
	}

	// TODO: Do different things depending on input type to avoid costly unnecessary casts.
	// Probably lots of speedups to be had here. Requires tagging types probably.
	/* eslint-disable-next-line no-unused-vars */
	castValue (value, outputType, inputType) {
		if (outputType === (
			'math_number' ||
			'math_integer' ||
			'math_whole_number' ||
			'math_positive_number' ||
			'math_angle')) { // numeric types
			
			// cast to number with unary plus, OR with zero if that fails / input is NaN
			let castedValue = e['||'](e['+'](value), e['number'](0));

			if (outputType === (
				'math_integer' ||
				'math_whole_number')) {
				
				// ROUND number types
				// call Math.round
				castedValue = e['call'](e['.'](e['id']('Math'), e['id']('round')), [castedValue]);
			}

			if (outputType === 'math_positive_number') {
				// POSITIVE number types
				// call Math.max(this number, 0)
				castedValue = e['call'](e['.'](e['id']('Math'), e['id']('max')), [castedValue, e['num'](0)]);
			}

			return castedValue;
		}

		if (outputType === 'boolean') {
			// Runtime boolean cast. Not necessary if input type is boolean, but we don't check that yet.
			return Builders.callUtilMethod('bool', [value]);
		}

		if (outputType === 'string') {
			// casts to string with `value + ""`, may be slower than String(value)
			return e['+'](value, e['string'](''));
		}

		return value;
	}

	getInput (input, shouldCast = true) {
		let inputNode;
		if (input.value instanceof ScriptPrims.Literal) {
			// TODO: revisit this
			if (input.type === 'procedure_arguments') {
				const compiledArgs = {};

				for (const arg of Object.keys(input.value.value)) {
					if (input.value.value.hasOwnProperty(arg)) {
						compiledArgs[arg] = this.getInput(input.value.value[arg]);
					}
				}

				return e['obj'](compiledArgs);
			} else {
				inputNode = Builders.literal(input.value.value);
			}
			
		} else if (input.value instanceof ScriptPrims.Script) {
			inputNode = e['block'](this.compileSubstack(input.value));
		} else if (input.value instanceof ScriptPrims.Block) {
			inputNode = this.compileBlock(input.value);
		} else {
			// TODO: find out a less janky way to do this
			inputNode = input;
		}

		return shouldCast ? this.castValue(inputNode, input.type) : inputNode;
	}

	// TODO: do more stuff here for custom proc defs and others
	getField (field) {
		return field.value.value;
	}

	makeFunction (expr) {
		return {type: 'ExpressionStatement', expression: e['function']([], expr, null)};
	}

	getNextContinuationID () {
		return this.object.continuations.length;
	}

	getBackpatchID () {
		// This makes debugging easier.
		return `bp_${this._backpatchIDCounter++}`;
	}

	setBackpatchDestination (backpatchID, continuationID) {
		this.backpatchMap[backpatchID] = continuationID;
	}

	pushContinuation (continuation) {
		let continuationID = this.getNextContinuationID();
		this.object.continuations.push(this.makeFunction(continuation));
		return continuationID;
	}

	continue (substack) {
		return this.pushContinuation(this.compileSubstack(substack));
	}

	compileBlock (block, index, script) {
		if (this.translators.hasOwnProperty(block.opcode)) {
			return this.translators[block.opcode](block, index, script);
		} else {
			console.warn(`Unknown opcode ${block.opcode}`);
		}
	}

	compileSubstack (substack) {
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
				compiledInstructions.push(
					Builders.setVisualForScope(VisibilityState.visibilityBlockScopes[currentBlock.opcode])
				);
			}

			compiledInstructions.push(this.compileBlock(currentBlock, instructionIndex, substack));
		}

		// If there's something on the return stack, pop it and add it to the substack.
		if (this.returnStack.length > 0) {
			compiledInstructions.push(this.returnStack.pop());
		}

		return compiledInstructions;
	}

	compileFunction (substack) {
		return this.makeFunction(this.compileSubstack(substack));
	}

	compileScript (script) {
		if (script.blocks[0].opcode === 'procedures_definition') {
			this.returnStack.push(Builders.endCall());
		}
		return new CompiledScript(script.blocks[0], this.continue(script.shifted));
	}
}

module.exports = CodeGenerator;
