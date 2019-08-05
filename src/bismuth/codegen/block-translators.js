const e = require("estree-builder");

const Builders = require("./es-builders");

const BlockTranslators = gen => {return{
	// Motion
	"motion_movesteps": block => {
		return e["statement"]( // S.forward(block steps input)
			Builders.callSpriteMethod("forward", [gen.getInput(block.args["STEPS"])])
		);
	},

	"motion_turnright": block => {
		return e["statement"]( // S.setDirection(S.direction + block degrees input)
			Builders.callSpriteMethod("setDirection", [
				e["+"](
					Builders.spriteProperty("direction"),
					gen.getInput(block.args["DEGREES"])
				)
			])
		);
	},

	"motion_turnleft": block => {
		return e["statement"]( // S.setDirection(S.direction - block degrees input)
			Builders.callSpriteMethod("setDirection", [
				e["-"](
					Builders.spriteProperty("direction"),
					gen.getInput(block.args["DEGREES"])
				)
			])
		);
	},

	"motion_pointindirection": block => {
		return e["statement"]( // S.setDirection(block direction input)
			Builders.callSpriteMethod("setDirection", [gen.getInput(block.args["DIRECTION"])])
		);
	},

	"motion_pointtowards": block => {
		return e["statement"](
			Builders.callSpriteMethod("pointTowards", [gen.getInput(block.args["TOWARDS"])])
		);
	},

	// Control
	"control_wait": (block, index, script) => {
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

		const timer = e["block"]([ // if (self.now - R.start < R.duration), then...
			e["if"](
				e["<"](
					e["-"](
						Builders.stageProperty("now"),
						Builders.RProperty("start")
					),
					Builders.RProperty("duration")
				),

				Builders.forceQueue(timerID) // forceQueue this whole thing all over again
			),
			
			// if we escaped the forceQueue, that must mean the timer's over
			// so, continue with the rest of the script
			Builders.forceQueue(continuationID)
		]);

		gen.pushContinuation(gen.makeFunction(timer));

		// Initialize the timer
		return e["block"]([
			Builders.save(),
			e["statement"]( // R.start = self.now
				e["="](
				Builders.RProperty("start"),
				Builders.stageProperty("now"))
			),
			e["statement"]( // R.duration = block duration input * 1000 (convert to millis.)
				e["="](
				Builders.RProperty("duration"),
				e["*"](gen.getInput(block.args["DURATION"]), e["num"](1000)))
			),
			
			// initial forceQueue of the timer check
			Builders.forceQueue(timerID)
		]);
	},

	"control_forever": (block, index, script) => {
		// For each iteration of the loop body,
		// run the loop contents, then queue up the loop body again.
		return e["block"]([
			gen.getInput(block.args["SUBSTACK"]),
			Builders.forceQueue(gen.getNextContinuationID())
		])
	},

	"control_repeat": (block, index, script) => {
		// Create a continuation for the rest of the blocks
		const continuationID = gen.continue(script.splice(index + 1)); 

		// Get the continuation ID to use for the loop body.
		let loopID;

		// For each iteration of the loop body:
		// check if the loop counter is > 0.5
		// If so:
		//   Decrement the loop counter
		//   Execute the loop contents
		// If not, then immediately call the rest of the script
		const loopBody = e["block"]([
			e["if"](
				e[">="](
					Builders.RProperty("count"),
					e["num"](0.5)
				),

				e["block"]([
					e["statement"](e["-="](Builders.RProperty("count"), e["num"](1))),
					gen.getInput(block.args["SUBSTACK"]),
					Builders.queue(loopID = gen.getNextContinuationID())
				]),

				Builders.restore()
			),

			Builders.immediateCall(continuationID)
		]);

		gen.pushContinuation(gen.makeFunction(loopBody));

		// Initialize the loop counter to its proper value,
		// then immediately call the first iteration of the loop
		return e["block"]([
			Builders.save(),

			e["statement"](
				e["="](Builders.RProperty("count"), gen.getInput(block.args["TIMES"]))
			),

			Builders.immediateCall(loopID),
		]);
	},
	
	// Data
	"data_variable": block => {
		return e["call"](e["id"]("getVar"), [gen.getInput(block.args["VARIABLE"])]);
	}
}};

module.exports = BlockTranslators;