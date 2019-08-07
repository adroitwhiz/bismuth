const e = require('estree-builder');

const Builders = require('./es-builders');

const BlockTranslators = gen => { return {
	// Motion
	'motion_movesteps': block => {
		return e['statement']( // S.forward(block steps input)
			Builders.callSpriteMethod('forward', [gen.getInput(block.args['STEPS'])])
		);
	},

	'motion_turnright': block => {
		return e['statement']( // S.setDirection(S.direction + block degrees input)
			Builders.callSpriteMethod('setDirection', [
				e['+'](
					Builders.spriteProperty('direction'),
					gen.getInput(block.args['DEGREES'])
				)
			])
		);
	},

	'motion_turnleft': block => {
		return e['statement']( // S.setDirection(S.direction - block degrees input)
			Builders.callSpriteMethod('setDirection', [
				e['-'](
					Builders.spriteProperty('direction'),
					gen.getInput(block.args['DEGREES'])
				)
			])
		);
	},

	'motion_pointindirection': block => {
		return e['statement']( // S.setDirection(block direction input)
			Builders.callSpriteMethod('setDirection', [gen.getInput(block.args['DIRECTION'])])
		);
	},

	'motion_pointtowards': block => {
		return e['statement'](
			Builders.callSpriteMethod('pointTowards', [gen.getInput(block.args['TOWARDS'])])
		);
	},

	'motion_gotoxy': block => {
		return e['statement']( // S.moveTo(block x input, block y input)
			Builders.callSpriteMethod('moveTo', [
				gen.getInput(block.args['X']),
				gen.getInput(block.args['Y'])
			])
		);
	},

	'motion_changexby': block => {
		return e['statement']( // S.moveTo(S.scratchX + block x input, S.scratchY)
			Builders.callSpriteMethod('moveTo', [
				e['+'](
					Builders.spriteProperty('scratchX'),
					gen.getInput(block.args['DX'])
				),
				Builders.spriteProperty('scratchY')
			])
		);
	},

	'motion_setx': block => {
		return e['statement']( // S.moveTo(block x input, S.scratchY)
			Builders.callSpriteMethod('moveTo', [
				gen.getInput(block.args['X']),
				Builders.spriteProperty('scratchY')
			])
		);
	},

	'motion_changeyby': block => {
		return e['statement']( // S.moveTo(S.scratchX, S.scratchY + block y input)
			Builders.callSpriteMethod('moveTo', [
				Builders.spriteProperty('scratchX'),
				e['+'](
					Builders.spriteProperty('scratchY'),
					gen.getInput(block.args['DY'])
				)
			])
		);
	},

	'motion_sety': block => {
		return e['statement']( // S.moveTo(S.scratchX, block y inp)
			Builders.callSpriteMethod('moveTo', [
				Builders.spriteProperty('scratchX'),
				gen.getInput(block.args['Y'])
			])
		);
	},

	// Control
	'control_wait': (block, index, script) => {
		// Since this block causes the script's execution to "yield",
		// we stop generating here and create two *continuations*,
		// one for the timer check and one for the rest of the script.

		// Create a continuation for the rest of the blocks
		const continuationID = gen.continue(script.splice(index + 1));

		// Get the continuation ID to use for the timer check.
		// We need this because the timer check works by yielding
		// and telling the runtime to continue to *itself* the next tick,
		// until the timer's run out, at which point it'll
		// immediately call the rest of the script.
		const timerID = gen.getNextContinuationID();

		const timer = e['block']([ // if (self.now - R.start < R.duration), then...
			e['if'](
				e['<'](
					e['-'](
						Builders.stageProperty('now'),
						Builders.RProperty('start')
					),
					Builders.RProperty('duration')
				),

				Builders.forceQueue(timerID) // forceQueue this whole thing all over again
			),
			
			// if we escaped the forceQueue, that must mean the timer's over
			// so, continue with the rest of the script
			Builders.restore(),
			Builders.forceQueue(continuationID)
		]);

		gen.pushContinuation(gen.makeFunction(timer));

		// Initialize the timer
		return e['block']([
			Builders.save(),
			e['statement']( // R.start = self.now
				e['='](
					Builders.RProperty('start'),
					Builders.stageProperty('now'))
			),
			e['statement']( // R.duration = block duration input * 1000 (convert to millis.)
				e['='](
					Builders.RProperty('duration'),
					e['*'](gen.getInput(block.args['DURATION']), e['num'](1000)))
			),
			
			// initial forceQueue of the timer check
			Builders.forceQueue(timerID)
		]);
	},

	'control_repeat': (block, index, script) => {
		// Create a continuation for the rest of the blocks
		const continuationID = gen.continue(script.splice(index + 1));

		const returnAddress = gen.getBackpatchID();
		gen.returnStack.push(Builders.forceQueue(Builders.backpatchID(returnAddress)));

		// Get the continuation ID to use for the loop body.
		let loopID;

		// For each iteration of the loop body:
		// check if the loop counter is > 0.5
		// If so:
		//   Decrement the loop counter
		//   Execute the loop contents
		// If not, then immediately call the rest of the script
		const loopBody = e['block']([
			e['if'](
				e['>='](
					Builders.RProperty('count'),
					e['num'](0.5)
				),

				e['block']([
					e['statement'](e['-='](Builders.RProperty('count'), e['num'](1))),
					gen.getInput(block.args['SUBSTACK']),
					Builders.queue(loopID = gen.getNextContinuationID())
				]),

				Builders.restore()
			),

			Builders.immediateCall(continuationID)
		]);

		gen.setBackpatchDestination(returnAddress, gen.getNextContinuationID());
		gen.pushContinuation(gen.makeFunction(loopBody));

		// Initialize the loop counter to its proper value,
		// then immediately call the first iteration of the loop
		return e['block']([
			Builders.save(),

			e['statement'](
				e['='](Builders.RProperty('count'), gen.getInput(block.args['TIMES']))
			),

			Builders.immediateCall(loopID)
		]);
	},

	'control_forever': block => {
		// At the end of every "forever" loop, there's an implicit "go back to the start of the loop body".
		// This will get lost if we call other blocks that chop up the script, so push it onto the return stack.
		// We don't know yet where the start of the loop body is, because compiling the loop body
		// might create more continuations, but the loop body needs to know about the return stack.
		// To accomplish this, we *backpatch* the proper return address in after compiling the loop body.
		const returnAddress = gen.getBackpatchID();
		gen.returnStack.push(Builders.forceQueue(Builders.backpatchID(returnAddress)));

		// For each iteration of the loop body,
		// run the loop contents, then queue up the loop body again.
		// Calling getInput on the substack is what triggers compilation and pushes continuations.
		const loopBody = gen.getInput(block.args['SUBSTACK']);
		// The next continuation ID is the one for this script, so backpatch the return address to it.
		gen.setBackpatchDestination(returnAddress, gen.getNextContinuationID());
		return e['block']([
			loopBody,
			Builders.forceQueue(Builders.backpatchID(returnAddress))
		]);
	},

	'control_if': (block, index, script) => {
		// At tne end of an "if" block, there's an implicit "continue with the rest of the script".
		const returnAddress = gen.getBackpatchID();
		// Create a continuation for the rest of the blocks.
		// Note that this is a slice instead of a splice, so it doesn't remove this code from this script.
		// That means if the branch is taken, it will call the continuation for the rest of the blocks then return.
		// If not, it will proceed with the rest of the blocks in this script. This means code is duplicated.
		const continuationID = gen.continue(script.slice(index + 1));
		// Backpatch the return address to the rest of the script.
		gen.setBackpatchDestination(returnAddress, continuationID);
		gen.returnStack.push(Builders.immediateCall(Builders.backpatchID(returnAddress)));

		const body = gen.getInput(block.args['SUBSTACK']);

		return e['if'](
			gen.getInput(block.args['CONDITION']),
			body
		);
	},

	'control_if_else': (block, index, script) => {
		const returnAddress = gen.getBackpatchID();
		// Create a continuation for the rest of the blocks
		const continuationID = gen.continue(script.slice(index + 1));
		
		gen.setBackpatchDestination(returnAddress, continuationID);

		gen.returnStack.push(Builders.immediateCall(Builders.backpatchID(returnAddress)));
		const bodyTrue = gen.getInput(block.args['SUBSTACK']);


		gen.returnStack.push(Builders.immediateCall(Builders.backpatchID(returnAddress)));
		const bodyFalse = gen.getInput(block.args['SUBSTACK2']);

		return e['if'](
			gen.getInput(block.args['CONDITION']),
			bodyTrue,
			bodyFalse
		);
	},

	// Operators
	'operator_add': block => {
		// NUM1 + NUM2
		return e['+'](
			gen.getInput(block.args['NUM1']),
			gen.getInput(block.args['NUM2'])
		);
	},

	'operator_subtract': block => {
		// NUM1 - NUM2
		return e['-'](
			gen.getInput(block.args['NUM1']),
			gen.getInput(block.args['NUM2'])
		);
	},

	'operator_multiply': block => {
		// NUM1 * NUM2
		return e['*'](
			gen.getInput(block.args['NUM1']),
			gen.getInput(block.args['NUM2'])
		);
	},

	'operator_divide': block => {
		// NUM1 / NUM2
		return e['/'](
			gen.getInput(block.args['NUM1']),
			gen.getInput(block.args['NUM2'])
		);
	},

	'operator_random': block => {
		// runtime method random(NUM1, NUM2)
		return Builders.callUtilMethod(
			'random',
			gen.getInput(block.args['NUM1']),
			gen.getInput(block.args['NUM2'])
		);
	},

	'operator_lt': block => {
		// runtime method compare(OPERAND1, OPERAND2) === -1
		// TODO: can make this do different things depending on input types
		return e['==='](
			Builders.callUtilMethod(
				'compare',
				gen.getInput(block.args['OPERAND1']),
				gen.getInput(block.args['OPERAND2'])
			),
			e['num'](-1)
		);
	},

	'operator_equals': block => {
		// runtime method equal(OPERAND1, OPERAND2)
		// TODO: can make this do different things depending on input types
		Builders.callUtilMethod(
			'equal',
			gen.getInput(block.args['OPERAND1']),
			gen.getInput(block.args['OPERAND2'])
		);
	},

	'operator_gt': block => {
		// runtime method compare(OPERAND1, OPERAND2) === +1
		// TODO: can make this do different things depending on input types
		return e['==='](
			Builders.callUtilMethod(
				'compare',
				gen.getInput(block.args['OPERAND1']),
				gen.getInput(block.args['OPERAND2'])
			),
			e['num'](1)
		);
	},

	'operator_and': block => {
		return e['&&'](
			gen.getInput(block.args['OPERAND1']),
			gen.getInput(block.args['OPERAND2'])
		);
	},

	'operator_or': block => {
		return e['||'](
			gen.getInput(block.args['OPERAND1']),
			gen.getInput(block.args['OPERAND2'])
		);
	},

	'operator_not': block => {
		return e['!'](
			gen.getInput(block.args['OPERAND'])
		);
	},

	'operator_join': block => {
		// STRING1 + STRING2
		return e['+'](
			gen.getInput(block.args['STRING1']),
			gen.getInput(block.args['STRING2'])
		);
	},

	'operator_letter_of': block => {
		// STRING.charAt(LETTER - 1)
		// charAt is zero-indexed, operator_letter_of is one-indexed.
		// Indexed in terms of UTF-16 code units.
		return e['.'](
			gen.getInput(block.args['STRING']),
			e['call'](
				'charAt',
				e['-'](
					gen.getInput(block.args['LETTER']),
					e['num'](1)
				)
			)
		);
	},
	
	'operator_length': block => {
		// STRING.length
		// Indexed in terms of UTF-16 code units.
		return e['.'](
			gen.getInput(block.args['STRING']),
			e['id']('length')
		);
	},

	'operator_mod': block => {
		// runtime mod(num1, num2)
		// Unfortunately we can't use the JS modulo operator.
		// Scratch modulo preserves the sign of the divisor, JS modulo preserves the sign of the dividend
		Builders.callUtilMethod(
			'mod',
			gen.getInput(block.args['NUM1']),
			gen.getInput(block.args['NUM2'])
		);
	},

	'operator_round': block => {
		// Math.round(NUM)
		return Builders.callMathFunction('round', gen.getInput(block.args['NUM']));
	},

	'operator_mathop': block => {
		const ANGLE_CONVERSION_FACTOR = e['num'](Math.PI / 180);
		const ANGLE_CONVERSION_FACTOR_INVERSE = e['num'](180 / Math.PI);
		// Miscellaneous math operator.
		// Does different things depending on the field value.
		// TODO: support dynamic math op or remove it from the runtime since it's broken in 3.0 anyway
		switch (gen.getField(block.args['OPERATOR'])) {
			case 'abs': return Builders.callMathFunction('abs', [gen.getInput(block.args['NUM'])]);
			case 'floor': return Builders.callMathFunction('floor', [gen.getInput(block.args['NUM'])]);
			case 'ceiling': return Builders.callMathFunction('ceil', [gen.getInput(block.args['NUM'])]);
			case 'sqrt': return Builders.callMathFunction('sqrt', [gen.getInput(block.args['NUM'])]);
			case 'sin': return Builders.callMathFunction('sin',
				[e['*'](gen.getInput(block.args['NUM']), ANGLE_CONVERSION_FACTOR)]
			);
			case 'cos': return Builders.callMathFunction('cos',
				[e['*'](gen.getInput(block.args['NUM']), ANGLE_CONVERSION_FACTOR)]
			);
			case 'tan': return Builders.callMathFunction('tan',
				[e['*'](gen.getInput(block.args['NUM']), ANGLE_CONVERSION_FACTOR)]
			);
			case 'asin': return Builders.callMathFunction('asin',
				[e['*'](gen.getInput(block.args['NUM']), ANGLE_CONVERSION_FACTOR_INVERSE)]
			);
			case 'acos': return Builders.callMathFunction('acos',
				[e['*'](gen.getInput(block.args['NUM']), ANGLE_CONVERSION_FACTOR_INVERSE)]
			);
			case 'atan': return Builders.callMathFunction('atan',
				[e['*'](gen.getInput(block.args['NUM']), ANGLE_CONVERSION_FACTOR_INVERSE)]
			);
			case 'ln': return Builders.callMathFunction('log', [gen.getInput(block.args['NUM'])]);
			case 'log': return Builders.callMathFunction('log10', [gen.getInput(block.args['NUM'])]);
			case 'e ^': return Builders.callMathFunction('exp', [gen.getInput(block.args['NUM'])]);
			case '10 ^': return Builders.callMathFunction('pow', [e['num'](10), gen.getInput(block.args['NUM'])]);
			default:
				console.warn(`Unrecognized math op ${gen.getField(block.args['OPERATOR'])}`);
				return e['num'](0);
		}
	},

	// Sensing
	'sensing_mousedown': () => {
		return Builders.stageProperty('mousePressed');
	},
	'sensing_mousex': () => {
		return Builders.stageProperty('mouseX');
	},

	'sensing_mousey': () => {
		return Builders.stageProperty('mouseY');
	},

	'sensing_timer': () => {
		// ((self.now - self.timerStart) / 1000)
		return e['/'](
			e['-'](
				Builders.stageProperty('now'),
				Builders.stageProperty('timerStart')
			),
			e['num'](1000)
		);
	},

	// Data
	'data_variable': block => {
		return e['call'](e['id']('getVar'), [gen.getInput(block.args['VARIABLE'])]);
	}
}; };

module.exports = BlockTranslators;
