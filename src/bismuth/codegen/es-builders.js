const e = require("estree-builder");

window.e = e;

window.astring = require("astring");

const VisibilityState = require("./visibility-state");

// Define identifiers so I can easily rename them later
const SPRITE_IDENTIFIER = e["id"]("S");
const STAGE_IDENTIFIER = e["id"]("self");
const R_IDENTIFIER = e["id"]("STACK_FRAME");
const VISUAL_IDENTIFIER = e["id"]("VISUAL");

const Builders = {
	backpatchID: backpatchID => {
		return {type: 'BackpatchedContinuationID', value: backpatchID};
	},
	continuationIdentifier: continuationID => {
		return continuationID.type && continuationID.type === 'BackpatchedContinuationID' ? continuationID : e["number"](continuationID);
	},

	consoleLog: args => {
		return e["call"](e["."](e["id"]("console"), e["id"]("log")), args);
	},

	spriteProperty: property => {
		return e["."](SPRITE_IDENTIFIER, e["id"](property));
	},

	stageProperty: property => {
		return e["."](STAGE_IDENTIFIER, e["id"](property));
	},


	RProperty: property => {
		return e["."](R_IDENTIFIER, e["id"](property));
	},

	callSpriteMethod: (method, args) => {
		return e["call"](Builders.spriteProperty(method), args);
	},

	queue: continuationID => {
		return e["block"]([
			e["statement"](e["call"](e["id"]("queue"), [Builders.continuationIdentifier(continuationID)])),
			e["return"]()
		]);
	},

	forceQueue: continuationID => {
		return e["block"]([
			e["statement"](e["call"](e["id"]("forceQueue"), [Builders.continuationIdentifier(continuationID)])),
			e["return"]()
		]);
	},

	immediateCall: continuationID => {
		return e["statement"](e["="](e["id"]("IMMEDIATE"), e["get"](Builders.spriteProperty("fns"), Builders.continuationIdentifier(continuationID))));
	},

	save: () => {
		return e["statement"](e["call"](e["id"]("save"), []));
	},

	restore: () => {
		return e["statement"](e["call"](e["id"]("restore"), []));
	},

	setVisualForScope: scope => {
		// If the scope is AFFECTS_VISUAL_ALWAYS, always return
		// "VISUAL = true". Otherwise, qualify it with an "if"
		// statement. This statement checks if the sprite is visible,
		// and if AFFECTS_VISUAL_FOR_VISIBLE_OR_PEN_DOWN,
		// also checks if the sprite's pen is down.
		const setVisualTrue = e["statement"](e["="](VISUAL_IDENTIFIER, e["true"]()));

		if (scope < VisibilityState.VisibilityScope.AFFECTS_VISUAL_ALWAYS) {
			return e["if"](
				scope === VisibilityState.VisibilityScope.AFFECTS_VISUAL_FOR_VISIBLE_OR_PEN_DOWN ?
					e ["||"](
						Builders.spriteProperty("visible"),
						Builders.spriteProperty("isPenDown")
					):
					Builders.spriteProperty("visible"),
				
				setVisualTrue
			)
		}

		return setVisualTrue;
	}
}

module.exports = Builders;