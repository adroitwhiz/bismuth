class MockSprite {
	constructor () {
		this.procedures = {};
		this.listeners = {
			whenClicked: [],
			whenCloned: [],
			whenGreenFlag: [],
			whenIReceive: {},
			whenKeyPressed: [],
			whenSceneStarts: [],
			whenSensorGreaterThan: []
		};
		for (let i = 0; i < 128; i++) {
			this.listeners.whenKeyPressed.push([]);
		}
		this.fns = [];
		this.scripts = [];
		this.continuations = [];
	}
}

module.exports = MockSprite;
