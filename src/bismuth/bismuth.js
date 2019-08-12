const P = (() => {
	const IO = require('./io');
	const Base = require('./spritebase');
	const Stage = require('./stage');
	const Sprite = require('./sprite');
	const Watcher = require('./watcher');

	const hasTouchEvents = 'ontouchstart' in document;

	const AudioContext = window.AudioContext || window.webkitAudioContext;
	const audioContext = AudioContext && new AudioContext();
	window.audioContext = audioContext;

	return {
		hasTouchEvents: hasTouchEvents,
		audioContext: audioContext,
		IO: IO,
		Base: Base,
		Stage: Stage,
		Sprite: Sprite,
		Watcher: Watcher
	};
})();

P.compile = require('./binds/compile2')(P);
P.runtime = require('./binds/runtime')(P);
P.player = require('./binds/player')(P);

window.P = P;
module.exports = P;
