const e = require('estree-builder');

const Builders = require('./es-builders');

// Common functions to be reused across block generation functions.
const GeneratorCommon = gen => { return {
	createTimer: (duration, afterTimerComplete, beforeTimerStart) => {
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
			afterTimerComplete
		]);

		gen.pushContinuation(gen.makeFunction(timer));

		// Initialize the timer
		return e['block']([
			beforeTimerStart,
			e['statement']( // R.start = self.now
				e['='](
					Builders.RProperty('start'),
					Builders.stageProperty('now'))
			),
			e['statement']( // initialize stack frame duration to "duration" argument
				e['='](Builders.RProperty('duration'), duration)
			),
			
			// initial forceQueue of the timer check
			Builders.forceQueue(timerID)
		]);
	},

	simpleMathOperator: (block, operator) => {
		return e[operator](
			gen.getInput(block.args['NUM1']),
			gen.getInput(block.args['NUM2'])
		);
	},

	sayOrThink: (block, isThink) => {
		return Builders.say(
			gen.getInput(block.args['MESSAGE']),
			isThink
		);
	},

	sayOrThinkForSecs: (block, index, script, isThink) => {
		// Create a continuation for the rest of the blocks
		const continuationID = gen.pushContinuation(
			gen.makeFunction(
				e['block']([
					e['if'](
						e['==='](
							Builders.RProperty('id'),
							Builders.spriteProperty('sayId')
						),
						Builders.say(e['null'](), false)
					),
					e['block'](gen.compileSubstack(script.splice(index + 1)))
				])
			)
		);

		return e['block']([
			gen.commonGenerators.createTimer(
				e['*'](gen.getInput(block.args['SECS']), e['num'](1000)),
				Builders.forceQueue(continuationID),
				Builders.sayForDurationStart(
					gen.getInput(block.args['MESSAGE']),
					isThink
				)
			)
		]);
	},

	// Update the sprite text bubble on show/hide so it doesn't stick around when it shouldn't.
	setVisible: visible => {
		return e['block']([
			e['='](Builders.spriteProperty('visible'), Builders.literal(visible)),
			Builders.updateBubbleIfSaying()
		]);
	}
}; };

module.exports = GeneratorCommon;
