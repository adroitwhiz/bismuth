const canvg = require("canvg");
const stackBlur = require("./lib/StackBlur");
const RGBColor = require("./lib/rgbcolor");
const JSZip = require("jszip");

const P = (() => {
	const IO = require('./io');
	const Base = require("./spritebase");
	const Stage = require("./stage");
	const Sprite = require("./sprite");
	const Watcher = require("./watcher");

	const SCALE = window.devicePixelRatio || 1;

	const hasTouchEvents = 'ontouchstart' in document;

	const AudioContext = window.AudioContext || window.webkitAudioContext;
	const audioContext = AudioContext && new AudioContext;
	window.audioContext = audioContext;

	const KEY_CODES = {
		space: 32,
		'left arrow': 37,
		'up arrow': 38,
		'right arrow': 39,
		'down arrow': 40,
		any: 'any'
	};

	const getKeyCode = keyName => KEY_CODES[keyName.toLowerCase()] || keyName.toUpperCase().charCodeAt(0);

	return {
		hasTouchEvents: hasTouchEvents,
		getKeyCode: getKeyCode,
		audioContext: audioContext,
		IO: IO,
		Base: Base,
		Stage: Stage,
		Sprite: Sprite,
		Watcher: Watcher
	};
})();

P.compile = require("./binds/compile")(P);
P.runtime = require("./binds/runtime")(P);
P.player = require("./binds/player")(P);

window.P = P;
export default P;