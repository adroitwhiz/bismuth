const e = require('estree-builder');

const Builders = require('./es-builders');

// Common functions to be reused across block generation functions.
const GeneratorCommon = gen => { return {
	waitUntilCondition: (condition, onConditionTrue) => {
		const loopId = gen.getNextContinuationID();

		const waitLoop = e['block']([
			e['if'](
				condition,
				onConditionTrue,
				Builders.forceQueue(loopId)
			)
		]);

		return gen.pushContinuation(waitLoop);
	},

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

		gen.pushContinuation(timer);

		let timerStartBlock = [
			Builders.save()
		];

		if (beforeTimerStart) {
			if (beforeTimerStart.type === 'BlockStatement') {
				timerStartBlock = timerStartBlock.concat(beforeTimerStart.body);
			} else {
				timerStartBlock.push(beforeTimerStart);
			}
		}

		// Initialize the timer
		return e['block'](timerStartBlock.concat([
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
		]));
	},

	simpleMathOperator: (block, operator) => {
		const mathOp = e[operator](
			gen.getInput(block.args['NUM1']),
			gen.getInput(block.args['NUM2'])
		);
		mathOp.__typeTag = 'number';
		return mathOp;
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

	// A reference to either a local or global variable.
	variableReference: block => {
		// If the stage has a variable by this name (e.g. it's a global variable), access that variable.
		// Otherwise, access the sprite's variable by that name whether it exists or not.
		// This captures the behavior of nonexistant variables always being created in local scope.
		const variableName = block.args['VARIABLE'].value.value;
		return e['get'](
			e['.'](
				gen.object.stage.vars[variableName] === undefined ?
					Builders.CONSTANTS.SPRITE_IDENTIFIER :
					Builders.CONSTANTS.STAGE_IDENTIFIER,
				e['id']('vars')
			),
			gen.getInput(block.args['VARIABLE'])
		);
	},

	setVariableVisible: (block, isVisible) => {
		// If the stage has a variable by this name (e.g. it's a global variable), call stage.setVariableVisible.
		// Otherwise, call SPRITE.setVariableVisible.
		const variableName = block.args['VARIABLE'].value.value;
		return e['call'](
			e['.'](
				gen.object.stage.vars[variableName] === undefined ?
					Builders.CONSTANTS.SPRITE_IDENTIFIER :
					Builders.CONSTANTS.STAGE_IDENTIFIER,
				e['id']('setVariableVisible')
			),
			[gen.getInput(block.args['VARIABLE']), Builders.literal(isVisible)]
		);
	},

	// A reference to either a local or global list.
	listReference: block => {
		// If the stage has a variable by this name (e.g. it's a global list), access that variable.
		// Otherwise, access the sprite's list by that name.
		// If the sprite doesn't have a list by that name, create one here.
		// This captures the behavior of nonexistant lists always being created in local scope.
		const listName = block.args['LIST'].value.value;

		const listIsLocal = gen.object.stage.lists[listName] === undefined;

		if (listIsLocal && gen.object.lists[listName] === undefined) {
			gen.object.lists[listName] = [];
		}

		return e['get'](
			e['.'](
				listIsLocal ?
					Builders.CONSTANTS.SPRITE_IDENTIFIER :
					Builders.CONSTANTS.STAGE_IDENTIFIER,
				e['id']('lists')
			),
			gen.getInput(block.args['LIST'])
		);
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
