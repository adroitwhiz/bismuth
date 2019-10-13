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

	'motion_goto': block => {
		return Builders.callSpriteMethod('gotoObject', [
			gen.getInput(block.args['TO'])
		]);
	},

	'motion_glidesecstoxy': (block, index, script) => {
		// Create a continuation for the rest of the blocks
		const continuationID = gen.continue(script.splice(index + 1));

		const glideStepID = gen.getNextContinuationID();

		// let t = Math.min((stage.now - STACK_FRAME.start) * STACK_FRAME.rate, 1)
		// S.moveTo(STACK_FRAME.initialX + (STACK_FRAME.deltaX * t), STACK_FRAME.initialY * (STACK_FRAME.deltaY * t))
		// if t < 1 forceQueue(this function) else restore() and proceed with the rest of the script
		const glideStep = e['block']([
			e['let'](
				e['id']('t'),
				Builders.callMathFunction('min', [
					e['*'](
						e['-'](
							Builders.stageProperty('now'),
							Builders.RProperty('start')
						),
						Builders.RProperty('rate')
					),
					e['num'](1)
				])
			),
			Builders.callSpriteMethod('moveTo', [
				e['+'](
					Builders.RProperty('initialX'),
					e['*'](
						Builders.RProperty('deltaX'),
						e['id']('t')
					)
				),
				e['+'](
					Builders.RProperty('initialY'),
					e['*'](
						Builders.RProperty('deltaY'),
						e['id']('t')
					)
				)
			]),
			e['if'](
				e['<'](e['id']('t'), e['num'](1)),
				Builders.forceQueue(glideStepID),
				Builders.immediateCall(continuationID)
			)
		]);

		gen.pushContinuation(glideStep);

		// STACK_FRAME.start = stage.now;
		// STACK_FRAME.rate = 0.001 / SECS; (convert seconds to millis.)
		// STACK_FRAME.initialX = S.scratchX;
		// STACK_FRAME.initialY = S.scratchY;
		// STACK_FRAME.deltaX = X - S.scratchX;
		// STACK_FRAME.deltaY = Y - S.scratchY;
		return e['block']([
			Builders.save(),
			e['='](
				Builders.RProperty('start'),
				Builders.stageProperty('now')
			),
			e['='](
				Builders.RProperty('rate'),
				e['/'](
					e['num'](0.001),
					gen.getInput(block.args['SECS'])
				)
			),
			e['='](
				Builders.RProperty('initialX'),
				Builders.spriteProperty('scratchX')
			),
			e['='](
				Builders.RProperty('initialY'),
				Builders.spriteProperty('scratchY')
			),
			e['='](
				Builders.RProperty('deltaX'),
				e['-'](
					gen.getInput(block.args['X']),
					Builders.spriteProperty('scratchX')
				)
			),
			e['='](
				Builders.RProperty('deltaY'),
				e['-'](
					gen.getInput(block.args['Y']),
					Builders.spriteProperty('scratchY')
				)
			),
			Builders.immediateCall(glideStepID)
		]);
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

	'motion_ifonedgebounce': () => {
		return Builders.callSpriteMethod('bounceOffEdge', []);
	},

	'motion_setrotationstyle': block => {
		// TODO: change the sprite to just use these names
		let rotationStyle;
		switch (gen.getField(block.args['STYLE'])) {
			case 'left-right':
				rotationStyle = 'leftRight';
				break;
			case 'don\'t rotate':
				rotationStyle = 'none';
				break;
			case 'all around':
				rotationStyle = 'normal';
				break;
		}

		return e['='](
			Builders.spriteProperty('rotationStyle'),
			e['string'](rotationStyle)
		);
	},

	'motion_xposition': () => {
		return Builders.spriteProperty('scratchX');
	},

	'motion_yposition': () => {
		return Builders.spriteProperty('scratchY');
	},

	'motion_direction': () => {
		return Builders.spriteProperty('direction');
	},

	// Looks
	'looks_sayforsecs': (block, index, script) => {
		return gen.commonGenerators.sayOrThinkForSecs(block, index, script, false);
	},

	'looks_say': block => {
		return gen.commonGenerators.sayOrThink(block, false);
	},

	'looks_thinkforsecs': (block, index, script) => {
		return gen.commonGenerators.sayOrThinkForSecs(block, index, script, true);
	},

	'looks_think': block => {
		return gen.commonGenerators.sayOrThink(block, true);
	},

	'looks_show': () => {
		return gen.commonGenerators.setVisible(true);
	},

	'looks_hide': () => {
		return gen.commonGenerators.setVisible(false);
	},

	'looks_switchcostumeto': block => {
		return Builders.callSpriteMethod('setCostume', [gen.getInput(block.args['COSTUME'])]);
	},

	'looks_nextcostume': () => {
		return Builders.callSpriteMethod('showNextCostume', []);
	},

	'looks_switchbackdropto': block => {
		// stage.setCostume(BACKDROP);
		// if (sceneChange().indexOf(BASE) !== -1) return;
		// TODO: figure this out
		return e['block']([
			Builders.callStageMethod('setCostume', [gen.getInput(block.args['BACKDROP'])]),
			e['if'](
				e['!=='](
					e['call'](
						e['.'](
							Builders.callRuntimeMethod('sceneChange', []),
							e['id']('indexOf')
						),
						[Builders.CONSTANTS.BASE_IDENTIFIER]
					),
					e['num'](-1)
				),
				e['return']()
			)
		]);
	},

	'looks_switchbackdroptoandwait': (block, index, script) => {
		// Like regular "switch backdrop", but stored on the stack with a 'wait until' loop in there.
		// save();
		// stage.setCostume(BACKDROP);
		// R.threads = sceneChange();
		// if (R.threads.indexOf(BASE) !== -1) return;
		// Then create an idle loop that checks each call whether the started threads are done,
		// and continues with the rest of the script once they are.

		// Create a continuation for the rest of the blocks
		const continuationID = gen.continue(script.splice(index + 1));

		const waitLoop = gen.commonGenerators.waitUntilCondition(
			e['!'](Builders.callRuntimeMethod('running', [Builders.RProperty('threads')])),
			e['block']([
				Builders.restore(),
				Builders.immediateCall(continuationID)
			])
		);

		return e['block']([
			Builders.save(),
			Builders.callStageMethod('setCostume', [gen.getInput(block.args['BACKDROP'])]),
			e['='](
				Builders.RProperty('threads'),
				Builders.callRuntimeMethod('sceneChange', [])
			),
			e['if'](
				e['!=='](
					e['call'](
						e['.'](Builders.RProperty('threads'), e['id']('indexOf')),
						[e['id']('BASE')]
					),
					e['num'](-1)
				),
				e['return']()
			),
			Builders.forceQueue(waitLoop)
		]);
	},

	'looks_nextbackdrop': () => {
		// stage.showNextCostume();
		// if (sceneChange().indexOf(BASE) !== -1) return;
		// TODO: figure this out
		return e['block']([
			Builders.callStageMethod('showNextCostume', []),
			e['if'](
				e['!=='](
					e['call'](
						e['.'](
							Builders.callRuntimeMethod('sceneChange', []),
							e['id']('indexOf')
						),
						[Builders.CONSTANTS.BASE_IDENTIFIER]
					),
					e['num'](-1)
				),
				e['return']()
			)
		]);
	},

	'looks_changeeffectby': block => {
		return Builders.callSpriteMethod('changeFilter', [
			gen.getInput(block.args['EFFECT']),
			gen.getInput(block.args['CHANGE'])
		]);
	},

	'looks_seteffectto': block => {
		return Builders.callSpriteMethod('setFilter', [
			gen.getInput(block.args['EFFECT']),
			gen.getInput(block.args['VALUE'])
		]);
	},

	'looks_cleargraphiceffects': () => {
		return Builders.callSpriteMethod('resetFilters', []);
	},

	'looks_changesizeby': block => {
		// S.size = Math.max(0, S.size + CHANGE)
		return e['='](
			Builders.spriteProperty('size'),
			Builders.callMathFunction('max', [
				e['num'](0),
				e['+'](
					Builders.spriteProperty('size'),
					gen.getInput(block.args['CHANGE'])
				)
			])
		);
	},

	'looks_setsizeto': block => {
		// S.size = Math.max(0, SIZE)
		return e['='](
			Builders.spriteProperty('size'),
			Builders.callMathFunction('max', [
				e['num'](0),
				gen.getInput(block.args['SIZE'])
			])
		);
	},

	'looks_gotofrontback': block => {
		return Builders.callRuntimeMethod('moveToFrontBack', [
			e['string'](gen.getField(block.args['FRONT_BACK']))
		]);
	},

	'looks_goforwardbackwardlayers': block => {
		const numLayers = gen.getInput(block.args['NUM']);
		return Builders.callRuntimeMethod('moveByLayers', [
			gen.getField(block.args['FORWARD_BACKWARD']) === 'forward' ?
				numLayers :
				e['-'](numLayers)
		]);
	},

	'looks_costumenumbername': block => {
		return gen.getField(block.args['NUMBER_NAME']) === 'number' ?
			e['+'](
				Builders.spriteProperty('currentCostumeIndex'),
				e['num'](1)
			) :
			Builders.callSpriteMethod('getCostumeName', []);
	},

	'looks_backdropnumbername': block => {
		return gen.getField(block.args['NUMBER_NAME']) === 'number' ?
			e['+'](
				Builders.stageProperty('currentCostumeIndex'),
				e['num'](1)
			) :
			Builders.callStageMethod('getCostumeName', []);
	},

	'looks_size': () => {
		return Builders.spriteProperty('size');
	},

	// Sound
	'sound_play': block => {
		return e['block']([
			e['let'](
				e['id']('sound'),
				Builders.callSpriteMethod('getSound', [gen.getInput(block.args['SOUND_MENU'])])
			),
			e['if'](
				e['!=='](e['id']('sound'), e['null']()),
				Builders.callRuntimeMethod('playSound', [e['id']('sound')])
			)
		]);
	},

	'sound_playuntildone': (block, index, script) => {
		// Create a continuation for the rest of the blocks
		const continuationID = gen.continue(script.splice(index + 1));

		return gen.commonGenerators.createTimer(
			// TODO: change sound duration to milliseconds
			e['*'](
				e['.'](e['id']('sound'), e['id']('duration')),
				e['num'](1000)
			),

			Builders.forceQueue(continuationID),
			e['block']([
				e['let'](
					e['id']('sound'),
					Builders.callSpriteMethod('getSound', [gen.getInput(block.args['SOUND_MENU'])])
				),
				e['if'](
					e['==='](e['id']('sound'), e['null']()),
					Builders.forceQueue(continuationID),
					Builders.callRuntimeMethod('playSound', [e['id']('sound')])
				)
			])
		);
	},

	'sound_stopallsounds': () => {
		return Builders.callStageMethod('stopAllSounds', []);
	},

	'sound_volume': () => {
		return e['*'](Builders.spriteProperty('volume'), e['num'](100));
	},

	// Events
	'event_broadcast': block => {
		// TODO: figure out what BASE is then determine what this does
		// let threads = broadcast(BROADCAST_INPUT);
		// if (threads.indexOf(BASE) !== -1) return;
		return e['block']([
			e['let'](
				e['id']('threads'),
				Builders.callRuntimeMethod('broadcast', [
					gen.getInput(block.args['BROADCAST_INPUT'])
				])
			),
			e['if'](
				e['!=='](
					e['call'](
						e['.'](e['id']('threads'), e['id']('indexOf')),
						[e['id']('BASE')]
					),
					e['num'](-1)
				),
				e['return']()
			)
		]);
	},

	'event_broadcastandwait': (block, index, script) => {
		// Like regular broadcast, but stored on the stack with a 'wait until' loop in there.
		// save();
		// R.threads = broadcast(BROADCAST_INPUT);
		// if (R.threads.indexOf(BASE) !== -1) return;
		// Then create an idle loop that checks each call whether the started threads are done,
		// and continues with the rest of the script once they are.

		// Create a continuation for the rest of the blocks
		const continuationID = gen.continue(script.splice(index + 1));

		const waitLoop = gen.commonGenerators.waitUntilCondition(
			e['!'](Builders.callRuntimeMethod('running', [Builders.RProperty('threads')])),
			e['block']([
				Builders.restore(),
				Builders.immediateCall(continuationID)
			])
		);

		return e['block']([
			Builders.save(),
			e['='](
				Builders.RProperty('threads'),
				Builders.callRuntimeMethod('broadcast', [
					gen.getInput(block.args['BROADCAST_INPUT'])
				])
			),
			e['if'](
				e['!=='](
					e['call'](
						e['.'](Builders.RProperty('threads'), e['id']('indexOf')),
						[e['id']('BASE')]
					),
					e['num'](-1)
				),
				e['return']()
			),
			Builders.forceQueue(waitLoop)
		]);
	},

	// Control
	'control_wait': (block, index, script) => {
		// Since this block causes the script's execution to "yield",
		// we stop generating here and create two *continuations*,
		// one for the timer check and one for the rest of the script.
		// Well, we did until I moved the first one to createTimer.

		// Create a continuation for the rest of the blocks
		const continuationID = gen.continue(script.splice(index + 1));

		return gen.commonGenerators.createTimer(
			e['*'](gen.getInput(block.args['DURATION']), e['num'](1000)),
			Builders.immediateCall(continuationID)
		);
	},

	'control_repeat': (block, index, script) => {
		// Create a continuation for the rest of the blocks
		const continuationID = gen.continue(script.splice(index + 1));

		const returnAddress = gen.getBackpatchID();
		gen.returnStack.push(Builders.queue(Builders.backpatchID(returnAddress)));

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
					gen.getInput(block.args['SUBSTACK'])
				]),

				Builders.restore()
			),

			Builders.immediateCall(continuationID)
		]);

		const loopID = gen.pushContinuation(loopBody);
		gen.setBackpatchDestination(returnAddress, loopID);

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
		gen.returnStack.push(Builders.queue(Builders.backpatchID(returnAddress)));

		// For each iteration of the loop body,
		// run the loop contents, then queue up the loop body again.
		// Calling getInput on the substack is what triggers compilation and pushes continuations.
		const loopBody = gen.getInput(block.args['SUBSTACK']);
		const loopID = gen.pushContinuation(loopBody);
		gen.setBackpatchDestination(returnAddress, loopID);
		return Builders.immediateCall(loopID);
	},

	'control_if': (block, index, script) => {
		// At tne end of an "if" block, there's an implicit "continue with the rest of the script".
		const returnAddress = gen.getBackpatchID();
		// Create a continuation for the rest of the blocks.
		const continuationID = gen.continue(script.splice(index + 1));
		// Backpatch the return address to the rest of the script.
		gen.setBackpatchDestination(returnAddress, continuationID);
		gen.returnStack.push(Builders.immediateCall(Builders.backpatchID(returnAddress)));

		const body = gen.getInput(block.args['SUBSTACK']);

		return e['if'](
			gen.getInput(block.args['CONDITION']),
			body,
			Builders.immediateCall(continuationID)
		);
	},

	'control_if_else': (block, index, script) => {
		const returnAddress = gen.getBackpatchID();
		// Create a continuation for the rest of the blocks
		const continuationID = gen.continue(script.splice(index + 1));

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

	'control_wait_until': (block, index, script) => {
		const continuationID = gen.continue(script.splice(index + 1));

		const waitID = gen.commonGenerators.waitUntilCondition(
			gen.getInput(block.args['CONDITION']),
			Builders.immediateCall(continuationID)
		);

		return Builders.queue(waitID);
	},

	'control_repeat_until': (block, index, script) => {
		const continuationID = gen.continue(script.splice(index + 1));

		const returnAddress = gen.getBackpatchID();
		gen.returnStack.push(Builders.queue(Builders.backpatchID(returnAddress)));

		const loopBody = e['block']([
			e['if'](
				gen.getInput(block.args['CONDITION']),
				Builders.immediateCall(continuationID)
			),
			gen.getInput(block.args['SUBSTACK'])
		]);

		const loopID = gen.pushContinuation(loopBody);
		gen.setBackpatchDestination(returnAddress, loopID);

		return Builders.immediateCall(loopID);
	},

	'control_stop': block => {
		switch (gen.getField(block.args['STOP_OPTION'])) {
			case 'all': {
				return e['block']([
					Builders.callStageMethod('stopAll', []),
					e['return']()
				]);
			}
			case 'this script': {
				return e['block']([
					Builders.callRuntimeMethod('endCall', []),
					e['return']()
				]);
			}
			case 'other scripts in sprite':
			case 'other scripts in stage': {
				return Builders.callRuntimeMethod('stopOtherScripts', []);
			}
		}
	},

	'control_create_clone_of': block => {
		return Builders.callRuntimeMethod('clone', [gen.getInput(block.args['CLONE_OPTION'])]);
	},

	'control_delete_this_clone': () => {
		return e['if'](
			Builders.spriteProperty('isClone'),
			e['block']([
				Builders.callSpriteMethod('remove', []),
				// Loop over all active threads, and swap them for undefined if they target this clone.
				// if (SPRITE.isClone)
				// for (let i = 0; i < stage.queue.length; i++)
				e['for'](
					e['let'](e['id']('i'), e['num'](0)),
					e['<'](e['id']('i'), e['.'](Builders.stageProperty('queue'), e['id']('length'))),
					e['++'](e['id']('i')),
					e['block']([
						// if (stage.queue[i] && stage.queue[i].sprite === SPRITE)
						e['if'](
							e['&&'](
								e['get'](Builders.stageProperty('queue'), e['id']('i')),
								e['==='](
									e['.'](
										e['get'](Builders.stageProperty('queue'), e['id']('i')),
										e['id']('sprite')
									),
									Builders.CONSTANTS.SPRITE_IDENTIFIER
								)
							),
							// stage.queue[i] = undefined;
							e['='](
								e['get'](Builders.stageProperty('queue'), e['id']('i')),
								e['undefined']()
							)
						)
					])
				)
			])
		);
	},

	// Sensing
	'sensing_touchingobject': block => {
		return Builders.callSpriteMethod('touching', [gen.getInput(block.args['TOUCHINGOBJECTMENU'])]);
	},

	'sensing_touchingcolor': block => {
		return Builders.callSpriteMethod('touchingColor', [gen.getInput(block.args['COLOR'])]);
	},

	'sensing_coloristouchingcolor': block => {
		return Builders.callSpriteMethod('colorIsTouchingColor', [
			gen.getInput(block.args['COLOR']),
			gen.getInput(block.args['COLOR2'])
		]);
	},

	'sensing_distanceto': block => {
		return Builders.callSpriteMethod('distanceTo', [
			gen.getInput(block.args['DISTANCETOMENU'])
		]);
	},

	'sensing_askandwait': (block, index, script) => {
		const continuationID = gen.continue(script.splice(index + 1));

		const waitForAnswerLoop = gen.commonGenerators.waitUntilCondition(
			e['!=='](
				Builders.RProperty('id'),
				Builders.stageProperty('promptId')
			),
			Builders.immediateCall(continuationID)
		);

		const waitForPromptLoop = gen.commonGenerators.waitUntilCondition(
			e['>='](
				Builders.stageProperty('promptId'),
				Builders.RProperty('id')
			),
			e['block']([
				Builders.callSpriteMethod('ask', [gen.getInput(block.args['QUESTION'])]),
				Builders.immediateCall(waitForAnswerLoop)
			])
		);

		// If another script starts an "ask and wait" before this one, we need to wait our turn.
		// We do this by idle-looping until the active prompt ID is >= the prompt ID we got.
		return e['block']([
			e['='](
				Builders.RProperty('id'),
				// using pre/postfix operators with estree-builder is playing with fire,
				// but this is always going to be postfix (stage.nextPromptID++).
				e['++'](Builders.stageProperty('nextPromptId'))
			),
			Builders.immediateCall(waitForPromptLoop)
		]);
	},

	'sensing_answer': () => {
		return Builders.stageProperty('answer');
	},

	'sensing_keypressed': block => {
		// Boolean(stage.keys[getKeyCode(KEY_OPTION)])
		return e['call'](
			e['id']('Boolean'),
			[e['get'](
				Builders.stageProperty('keys'),
				Builders.callRuntimeMethod('getKeyCode', [
					gen.getInput(block.args['KEY_OPTION'])
				])
			)]
		);
	},

	'sensing_mousedown': () => {
		return Builders.stageProperty('mousePressed');
	},
	'sensing_mousex': () => {
		return Builders.stageProperty('mouseX');
	},

	'sensing_mousey': () => {
		return Builders.stageProperty('mouseY');
	},

	'sensing_loudness': () => {
		// Mic loudness is currently unimplemented, but all reporters must return values or compilation will fail.
		return e['num'](0);
	},

	'sensing_loud': () => {
		return e['false'];
	},

	'sensing_timer': () => {
		// ((stage.rightNow() - self.timerStart) / 1000)
		// Using the cached "stage.now" will freeze warp mode loops that stop after the timer reaches a certain value.
		// Despite causing two demo projects to freeze the browser, this bug was in the original codegen. Thanks Nathan.
		return e['/'](
			e['-'](
				Builders.callStageMethod('rightNow', []),
				Builders.stageProperty('timerStart')
			),
			e['num'](1000)
		);
	},

	'sensing_resettimer': () => {
		return e['='](
			Builders.stageProperty('timerStart'),
			Builders.stageProperty('now')
		);
	},

	'sensing_of': block => {
		return Builders.callRuntimeMethod('attribute', [
			gen.getInput(block.args['PROPERTY']),
			gen.getInput(block.args['OBJECT'])
		]);
	},

	'sensing_current': block => {
		return Builders.callRuntimeMethod('timeAndDate', [
			gen.getInput(block.args['CURRENTMENU'])
		]);
	},

	'sensing_dayssince2000': () => {
		// (Date.now() - epoch) / 86400000
		return e['/'](
			e['-'](
				e['call'](
					e['.'](
						e['id']('Date'),
						e['id']('now')
					),
					[]
				),
				// runtime property; change this if changing scope stuff
				e['id']('epoch')
			),
			e['num'](86400000)
		);
	},

	'sensing_username': () => {
		// Username block returns empty string for non-logged-in users
		return e['str']('');
	},

	// Operators
	'operator_add': block => {
		// NUM1 + NUM2
		return gen.commonGenerators.simpleMathOperator(block, '+');
	},

	'operator_subtract': block => {
		// NUM1 - NUM2
		return gen.commonGenerators.simpleMathOperator(block, '-');
	},

	'operator_multiply': block => {
		// NUM1 * NUM2
		return gen.commonGenerators.simpleMathOperator(block, '*');
	},

	'operator_divide': block => {
		// NUM1 / NUM2
		return gen.commonGenerators.simpleMathOperator(block, '/');
	},

	'operator_random': block => {
		// runtime method random(NUM1, NUM2)
		return Builders.callUtilMethod(
			'random',
			[
				gen.getInput(block.args['FROM']),
				gen.getInput(block.args['TO'])
			]
		);
	},

	'operator_lt': block => {
		// runtime method compare(OPERAND1, OPERAND2) === -1
		// TODO: can make this do different things depending on input types
		return e['==='](
			Builders.callUtilMethod(
				'compare',
				[
					gen.getInput(block.args['OPERAND1']),
					gen.getInput(block.args['OPERAND2'])
				]
			),
			e['num'](-1)
		);
	},

	'operator_equals': block => {
		// runtime method equal(OPERAND1, OPERAND2)
		// TODO: can make this do different things depending on input types
		return Builders.callUtilMethod(
			'equal',
			[
				gen.getInput(block.args['OPERAND1']),
				gen.getInput(block.args['OPERAND2'])
			]
		);
	},

	'operator_gt': block => {
		// runtime method compare(OPERAND1, OPERAND2) === +1
		// TODO: can make this do different things depending on input types
		return e['==='](
			Builders.callUtilMethod(
				'compare',
				[
					gen.getInput(block.args['OPERAND1']),
					gen.getInput(block.args['OPERAND2'])
				]
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
			gen.getInput(block.args['STRING1'], true),
			gen.getInput(block.args['STRING2'], true)
		);
	},

	'operator_letter_of': block => {
		// STRING.charAt(LETTER - 1)
		// charAt is zero-indexed, operator_letter_of is one-indexed.
		// Indexed in terms of UTF-16 code units.
		return e['call'](
			e['.'](gen.getInput(block.args['STRING'], true), e['id']('charAt')),
			[e['-'](
				gen.getInput(block.args['LETTER']),
				e['num'](1)
			)]
		);
	},

	'operator_length': block => {
		// STRING.length
		// Indexed in terms of UTF-16 code units.
		return e['.'](
			gen.getInput(block.args['STRING'], true),
			e['id']('length')
		);
	},

	'operator_mod': block => {
		// runtime mod(num1, num2)
		// Unfortunately we can't use the JS modulo operator.
		// Scratch modulo preserves the sign of the divisor, JS modulo preserves the sign of the dividend
		return Builders.callUtilMethod(
			'mod',
			[gen.getInput(block.args['NUM1']), gen.getInput(block.args['NUM2'])]
		);
	},

	'operator_round': block => {
		// Math.round(NUM)
		return Builders.callMathFunction('round', [gen.getInput(block.args['NUM'])]);
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
			case 'asin': return e['*'](
				Builders.callMathFunction('asin', [gen.getInput(block.args['NUM'])]),
				ANGLE_CONVERSION_FACTOR_INVERSE
			);
			case 'acos': return e['*'](
				Builders.callMathFunction('acos', [gen.getInput(block.args['NUM'])]),
				ANGLE_CONVERSION_FACTOR_INVERSE
			);
			case 'atan': return e['*'](
				Builders.callMathFunction('atan', [gen.getInput(block.args['NUM'])]),
				ANGLE_CONVERSION_FACTOR_INVERSE
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

	// Data
	'data_variable': block => {
		return gen.commonGenerators.variableReference(block);
	},

	'data_setvariableto': block => {
		return e['='](gen.commonGenerators.variableReference(block), gen.getInput(block.args['VALUE']));
	},

	'data_changevariableby': block => {
		return e['='](
			gen.commonGenerators.variableReference(block),
			e['+'](
				gen.castValue(gen.commonGenerators.variableReference(block), 'math_number'),
				gen.getInput(block.args['VALUE'])
			)
		);
	},

	'data_showvariable': block => {
		return gen.commonGenerators.setVariableVisible(block, true);
	},

	'data_hidevariable': block => {
		return gen.commonGenerators.setVariableVisible(block, false);
	},

	'data_listcontents': block => {
		return Builders.callRuntimeMethod('contentsOfList', [
			gen.commonGenerators.listReference(block)
		]);
	},

	'data_addtolist': block => {
		// LIST.push(ITEM)
		return e['call'](
			e['.'](
				gen.commonGenerators.listReference(block),
				e['id']('push')
			),
			[gen.getInput(block.args['ITEM'])]
		);
	},

	'data_deleteoflist': block => {
		return Builders.callRuntimeMethod('deleteLineOfList', [
			gen.commonGenerators.listReference(block),
			gen.getInput(block.args['INDEX'])
		]);
	},

	'data_deletealloflist': block => {
		// TODO: reinit list
		return Builders.callRuntimeMethod('deleteLineOfList', [
			gen.commonGenerators.listReference(block),
			e['string']('all')
		]);
	},

	'data_insertatlist': block => {
		return Builders.callRuntimeMethod('insertInList', [
			gen.commonGenerators.listReference(block),
			gen.getInput(block.args['INDEX']),
			gen.getInput(block.args['ITEM'])
		]);
	},

	'data_replaceitemoflist': block => {
		return Builders.callRuntimeMethod('setLineOfList', [
			gen.commonGenerators.listReference(block),
			gen.getInput(block.args['INDEX']),
			gen.getInput(block.args['ITEM'])
		]);
	},

	'data_itemoflist': block => {
		return Builders.callRuntimeMethod('getLineOfList', [
			gen.commonGenerators.listReference(block),
			gen.getInput(block.args['INDEX'])
		]);
	},

	'data_lengthoflist': block => {
		return e['.'](
			gen.commonGenerators.listReference(block),
			e['id']('length')
		);
	},

	'data_listcontainsitem': block => {
		return Builders.callRuntimeMethod('listContains', [
			gen.commonGenerators.listReference(block),
			gen.getInput(block.args['ITEM'])
		]);
	},

	// Custom procedures wOoOoOoO
	'procedures_call': (block, index, script) => {
		const continuationID = gen.continue(script.splice(index + 1));

		if (gen.getField(block.args['PROCEDURE']) === 'bismuth debug') {
			return e['block']([
				e['statement'](e['id']('debugger')),
				Builders.immediateCall(continuationID)
			]);
		}

		return e['block']([
			Builders.callRuntimeMethod('call', [
				e['get'](Builders.spriteProperty('procedures'), gen.getInput(block.args['PROCEDURE'])),
				Builders.literal(continuationID),
				gen.getInput(block.args['ARGUMENTS'])
			]),
			e['return']()
		]);
	},

	'argument_reporter_string_number': block => {
		return e['get'](
			Builders.callStackFrameProperty('args'),
			e['get'](Builders.callStackFrameProperty('argMap'), gen.getInput(block.args['VALUE']))
		);
	},

	// TODO: something different?
	'argument_reporter_boolean': block => {
		return e['get'](
			Builders.callStackFrameProperty('args'),
			e['get'](Builders.callStackFrameProperty('argMap'), gen.getInput(block.args['VALUE']))
		);
	},

	// Pen
	'pen_clear': () => {
		return Builders.callRuntimeMethod('penClear', []);
	},

	'pen_stamp': () => {
		return Builders.callSpriteMethod('penStamp', []);
	},

	'pen_penDown': () => {
		return e['block']([
			e['='](e['.'](Builders.spriteProperty('penState'), e['id']('penDown')), e['true']()),
			Builders.callSpriteMethod('penDot', [])
		]);
	},

	'pen_penUp': () => {
		return e['='](e['.'](Builders.spriteProperty('penState'), e['id']('penDown')), e['false']());
	},

	'pen_setPenColorToColor': block => {
		const penColor = e['.'](Builders.spriteProperty('penState'), e['id']('colorNumeric'));
		return e['block']([
			e['='](
				penColor,
				gen.getInput(block.args['COLOR'])
			),
			Builders.callSpriteMethod('updatePenCSS', [])
		]);
	},

	'pen_changePenHueBy': block => {
		// The stored pen hue is in Scratch 3.0 form (0-100). 2.0 goes from 0-200, so double it.
		return e['block']([
			Builders.setPenHSVIfNumeric(),
			Builders.callSpriteMethod('setPenColorLegacy', [
				e['+'](
					e['*'](
						e['.'](Builders.spriteProperty('penState'), e['id']('hue')),
						e['num'](2)
					),
					gen.getInput(block.args['HUE'])
				)
			]),
			Builders.callSpriteMethod('updatePenCSS', [])
		]);
	},

	'pen_setPenHueToNumber': block => {
		return e['block']([
			Builders.setPenHSVIfNumeric(),
			Builders.callSpriteMethod('setPenColorLegacy', [gen.getInput(block.args['HUE'])]),
			Builders.callSpriteMethod('updatePenCSS', [])
		]);
	},

	'pen_changePenShadeBy': block => {
		return e['block']([
			Builders.setPenHSVIfNumeric(),
			Builders.callSpriteMethod('setPenShadeLegacy', [
				e['+'](
					e['.'](Builders.spriteProperty('penState'), e['id']('_shade')),
					gen.getInput(block.args['SHADE'])
				)
			]),
			Builders.callSpriteMethod('updatePenCSS', [])
		]);
	},

	'pen_setPenShadeToNumber': block => {
		return e['block']([
			Builders.setPenHSVIfNumeric(),
			Builders.callSpriteMethod('setPenShadeLegacy', [gen.getInput(block.args['SHADE'])]),
			Builders.callSpriteMethod('updatePenCSS', [])
		]);
	},

	'pen_changePenSizeBy': block => {
		// let size = SPRITE.penState.diameter + SIZE;
		// SPRITE.penState.diameter = Math.max(size, 1);
		const penDiameter = e['.'](Builders.spriteProperty('penState'), e['id']('diameter'));
		return e['block']([
			e['let'](
				e['id']('size'),
				e['+'](
					penDiameter,
					gen.getInput(block.args['SIZE'])
				)
			),
			e['='](
				penDiameter,
				Builders.callMathFunction('max', [
					e['id']('size'),
					e['num'](1)
				])
			)
		]);
	},

	'pen_setPenSizeTo': block => {
		// let size = SIZE;
		// SPRITE.penState.diameter = Math.max(size, 1);
		return e['block']([
			e['let'](e['id']('size'), gen.getInput(block.args['SIZE'])),
			e['='](
				e['.'](Builders.spriteProperty('penState'), e['id']('diameter')),
				Builders.callMathFunction('max', [
					e['id']('size'),
					e['num'](1)
				])
			)
		]);
	},

	// Music
	'music_playDrumForBeats': (block, index, script) => {
		// Create a continuation for the rest of the blocks
		const continuationID = gen.continue(script.splice(index + 1));

		// timer duration = BEATS * 60000 / stage.tempoBPM
		// playSpan(DRUMS[DRUM - 1] || DRUMS[2], 60, 10)
		return gen.commonGenerators.createTimer(
			Builders.musicDuration(gen.getInput(block.args['BEATS'])),
			Builders.immediateCall(continuationID),
			Builders.callRuntimeMethod('playSpan', [
				// runtime property; change this if changing scope stuff
				e['||'](
					e['get'](
						e['id']('DRUMS'),
						e['-'](
							gen.getInput(block.args['DRUM']),
							e['num'](1)
						)
					),
					e['get'](
						e['id']('DRUMS'),
						e['num'](2)
					)
				),
				e['num'](60),
				e['num'](10)
			])
		);
	},

	'music_restForBeats': (block, index, script) => {
		// Create a continuation for the rest of the blocks
		const continuationID = gen.continue(script.splice(index + 1));

		// timer duration = BEATS * 60000 / stage.tempoBPM
		return gen.commonGenerators.createTimer(
			Builders.musicDuration(gen.getInput(block.args['BEATS'])),
			Builders.immediateCall(continuationID)
		);
	},

	'music_playNoteForBeats': (block, index, script) => {
		// Create a continuation for the rest of the blocks
		const continuationID = gen.continue(script.splice(index + 1));

		// timer duration = BEATS * 60000 / stage.tempoBPM
		// playNote(NOTE, timer duration)
		return gen.commonGenerators.createTimer(
			e['id']('duration'),
			Builders.immediateCall(continuationID),
			e['block']([
				e['let'](e['id']('duration'), Builders.musicDuration(gen.getInput(block.args['BEATS']))),
				Builders.callRuntimeMethod('playNote', [
					gen.getInput(block.args['NOTE']),
					e['id']('duration')
				])
			])
		);
	},

	'music_setInstrument': block => {
		// Clamp instrument to range of possible instruments with Math.min and Math.max
		return e['='](
			Builders.spriteProperty('instrument'),
			Builders.callMathFunction('max', [
				e['num'](0),
				Builders.callMathFunction('min', [
					e['-'](
						gen.getInput(block.args['INSTRUMENT']),
						e['num'](1)
					),
					e['-'](
						// runtime property; change this if changing scope stuff
						e['.'](e['id']('INSTRUMENTS'), e['id']('length')),
						e['num'](1)
					)
				])
			])
		);
	},

	'music_changeTempo': block => {
		// Clamp tempo between 20 and 500 BPM
		return e['='](
			Builders.stageProperty('tempoBPM'),
			Builders.callMathFunction('max', [
				e['num'](20),
				Builders.callMathFunction('min', [
					e['+'](
						gen.getInput(block.args['TEMPO']),
						Builders.stageProperty('tempoBPM')
					),
					e['num'](500)
				])
			])
		);
	},

	'music_setTempo': block => {
		// Clamp tempo between 20 and 500 BPM
		return e['='](
			Builders.stageProperty('tempoBPM'),
			Builders.callMathFunction('max', [
				e['num'](20),
				Builders.callMathFunction('min', [
					gen.getInput(block.args['TEMPO']),
					e['num'](500)
				])
			])
		);
	},

	'music_getTempo': () => {
		return Builders.stageProperty('tempoBPM');
	}
}; };

module.exports = BlockTranslators;
