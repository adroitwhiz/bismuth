const e = require('estree-builder');

window.e = e;

window.astring = require('astring');

const VisibilityState = require('./visibility-state');

// Define identifiers so I can easily rename them later
const SPRITE_IDENTIFIER = e['id']('SPRITE');
const STAGE_IDENTIFIER = e['id']('self');
const R_IDENTIFIER = e['id']('STACK_FRAME');
const VISUAL_IDENTIFIER = e['id']('VISUAL');
const CALL_STACK_FRAME_IDENTIFIER = e['id']('C');

// Similar to estree-builder, this is a collection of "AST builder" functions, but for Bismuth-specific stuff.
const Builders = {
	// estree-builder does not have this for some reason
	literal: value => {
		return {type: 'Literal', value: value};
	},

	// Prevent unnecessary block scoping that makes the code harder to read by combining block statements.
	// Returns a new block statement.
	concatBlockStatements: statements => {
		const newStatementBody = [];
		for (const statement of statements) {
			for (const node of statement.body) {
				newStatementBody.push(node);
			}
		}
		return {
			type: 'BlockStatement',
			body: newStatementBody
		};
	},

	backpatchID: backpatchID => {
		return {type: 'BackpatchedContinuationID', value: backpatchID};
	},

	continuationIdentifier: continuationID => {
		return continuationID.type && (continuationID.type === 'BackpatchedContinuationID') ?
			continuationID :
			e['number'](continuationID);
	},

	consoleLog: args => {
		return e['call'](
			e['.'](e['id']('console'), e['id']('log')),
			typeof args === 'string' ? e['string'](args) : args
		);
	},

	spriteProperty: property => {
		return e['.'](SPRITE_IDENTIFIER, e['id'](property));
	},

	stageProperty: property => {
		return e['.'](STAGE_IDENTIFIER, e['id'](property));
	},


	RProperty: property => {
		return e['.'](R_IDENTIFIER, e['id'](property));
	},

	callStackFrameProperty: property => {
		return e['.'](CALL_STACK_FRAME_IDENTIFIER, e['id'](property));
	},

	callSpriteMethod: (method, args) => {
		if (!(args instanceof Array)) {
			throw new Error(`args should be array: ${method}`);
		}
		return e['call'](Builders.spriteProperty(method), args);
	},

	callStageMethod: (method, args) => {
		if (!(args instanceof Array)) {
			throw new Error(`args should be array: ${method}`);
		}
		return e['call'](Builders.stageProperty(method), args);
	},

	// Currently calls a method with completely implicit scope, but set up so this can be changed
	callUtilMethod: (method, args) => {
		if (!(args instanceof Array)) {
			throw new Error(`args should be array: ${method}`);
		}
		return e['call'](e['id'](method), args);
	},

	// Currently calls a method with completely implicit scope, but set up so this can be changed
	callRuntimeMethod: (method, args) => {
		if (!(args instanceof Array)) {
			throw new Error(`args should be array: ${method}`);
		}
		return e['call'](e['id'](method), args);
	},

	callMathFunction: (method, args) => {
		if (!(args instanceof Array)) {
			throw new Error(`args should be array: ${method}`);
		}
		return e['call'](
			e['.'](e['id']('Math'), e['id'](method)),
			args
		);
	},

	queue: continuationID => {
		return e['block']([
			e['statement'](Builders.callRuntimeMethod('queue', [Builders.continuationIdentifier(continuationID)])),
			e['return']()
		]);
	},

	forceQueue: continuationID => {
		return e['block']([
			e['statement'](Builders.callRuntimeMethod('forceQueue', [Builders.continuationIdentifier(continuationID)])),
			e['return']()
		]);
	},

	immediateCall: continuationID => {
		return e['block']([
			e['statement'](
				e['='](
					e['id']('IMMEDIATE'),
					e['get'](Builders.spriteProperty('fns'), Builders.continuationIdentifier(continuationID))
				)
			),
			e['return']()
		]);
	},

	save: () => {
		return e['statement'](Builders.callRuntimeMethod('save', []));
	},

	restore: () => {
		return e['statement'](Builders.callRuntimeMethod('restore', []));
	},

	endCall: () => {
		return e['call'](e['id']('endCall'), []);
	},

	setVisualForScope: scope => {
		// If the scope is AFFECTS_VISUAL_ALWAYS, always return
		// "VISUAL = true". Otherwise, qualify it with an "if"
		// statement. This statement checks if the sprite is visible,
		// and if AFFECTS_VISUAL_FOR_VISIBLE_OR_PEN_DOWN,
		// also checks if the sprite's pen is down.
		const setVisualTrue = e['statement'](e['='](VISUAL_IDENTIFIER, e['true']()));

		if (scope < VisibilityState.VisibilityScope.AFFECTS_VISUAL_ALWAYS) {
			return e['if'](
				scope === VisibilityState.VisibilityScope.AFFECTS_VISUAL_FOR_VISIBLE_OR_PEN_DOWN ?
					e ['||'](
						Builders.spriteProperty('visible'),
						Builders.spriteProperty('isPenDown')
					) :
					Builders.spriteProperty('visible'),
				
				setVisualTrue
			);
		}

		return setVisualTrue;
	},

	say: (message, isThink) => {
		return Builders.callSpriteMethod('say', [message, Builders.literal(isThink)]);
	},

	sayForDurationStart: (message, isThink) => {
		return e['block']([
			Builders.save(),
			e['='](
				// The 'say' runtime function gives back an ID, which we add to the stack frame.
				// This is so that when we go back to un-say the bubble,
				// we can make sure it's the same one we originally said.
				Builders.RProperty('id'),
				Builders.say(message, isThink)
			)
		]);
	},

	updateBubbleIfSaying: () => {
		return e['if'](
			Builders.spriteProperty('saying'),
			Builders.callSpriteMethod('updateBubble', [])
		);
	},

	CONSTANTS: {
		SPRITE_IDENTIFIER: SPRITE_IDENTIFIER,
		STAGE_IDENTIFIER: STAGE_IDENTIFIER,
		R_IDENTIFIER: R_IDENTIFIER,
		VISUAL_IDENTIFIER: VISUAL_IDENTIFIER
	}
};

module.exports = Builders;
