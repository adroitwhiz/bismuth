// Maximum number of immediate calls that can be made per tick.
// Done to prevent bad code from hanging the browser.
const MAX_IMMEDIATE_CALLS = 10000000;

const runtime = (function (P) {
	'use strict';

	// var self, SPRITE, STACK_FRAME, STACK, C, WARP, CALLS, BASE, THREAD, IMMEDIATE, VISUAL;

	// The stage. Not sure why it's named this way.
	let self;

	// The sprite for which scripts are currently being executed.
	let SPRITE;

	// The current stack frame. Used for storing state like the timer, text bubble ID, etc.
	let STACK_FRAME;

	// The stack on which the stack frames are stored.
	let STACK;

	// The current procedure call stack frame.
	let C;

	// The procedure call stack.
	let CALLS;

	// Warp-mode counter. Incremented when entering warp-mode and decremented when leaving it.
	let WARP;

	let BASE;

	// The thread currently being executed. Corresponds to a "script".
	let THREAD;

	// A function to be immediately executed after the current one.
	let IMMEDIATE;

	// Tracks whether a visual change was made this frame. If so, yields threads until next frame.
	let VISUAL;

	const getKeyCode = require('../util/get-key-code');

	// Cast to boolean.
	const bool = function (v) {
		return +v !== 0 && v !== '' && v !== 'false' && v !== false;
	};

	// Compare two values using Scratch rules.
	// TODO: Redo this using Scratch 3 techniques and possibly make it faster (e.g. by removing regex).
	const DIGIT = /\d/;
	const compare = function (x, y) {
		if ((typeof x === 'number' || DIGIT.test(x)) && (typeof y === 'number' || DIGIT.test(y))) {
			const nx = Number(x);
			const ny = Number(y);
			// This is equivalent to "are neither nx nor ny NaN?" because NaN never equals itself
			if (nx === nx && ny === ny) {
				return nx < ny ? -1 : nx === ny ? 0 : 1;
			}
		}
		const xs = String(x).toLowerCase();
		const ys = String(y).toLowerCase();
		return xs < ys ? -1 : xs === ys ? 0 : 1;
	};
	const numLess = function (nx, y) {
		if (typeof y === 'number' || DIGIT.test(y)) {
			const ny = +y;
			if (ny === ny) {
				return nx < ny;
			}
		}
		const ys = String(y).toLowerCase();
		return String(nx) < ys;
	};
	const numGreater = function (nx, y) {
		if (typeof y === 'number' || DIGIT.test(y)) {
			const ny = +y;
			if (ny === ny) {
				return nx > ny;
			}
		}
		const ys = String(y).toLowerCase();
		return String(nx) > ys;
	};

	// Optimized version of "compare" that only checks equality.
	const equal = function (x, y) {
		if ((typeof x === 'number' || DIGIT.test(x)) && (typeof y === 'number' || DIGIT.test(y))) {
			const nx = +x;
			const ny = +y;
			if (nx === nx && ny === ny) {
				return nx === ny;
			}
		}
		const xs = String(x).toLowerCase();
		const ys = String(y).toLowerCase();
		return xs === ys;
	};
	const numEqual = function (nx, y) {
		if (typeof y === 'number' || DIGIT.test(y)) {
			const ny = +y;
			return ny === ny && nx === ny;
		}
		return false;
	};

	const mod = function (x, y) {
		let r = x % y;
		if (r / y < 0) {
			r += y;
		}
		return r;
	};

	const random = function (x, y) {
		x = +x || 0;
		y = +y || 0;
		if (x > y) {
			const tmp = y;
			y = x;
			x = tmp;
		}
		if (x % 1 === 0 && y % 1 === 0) {
			return Math.floor(Math.random() * (y - x + 1)) + x;
		}
		return (Math.random() * (y - x)) + x;
	};

	const moveByLayers = function (numLayers) {
		const i = self.children.indexOf(SPRITE);
		if (i !== -1) {
			self.children.splice(i, 1);
			self.children.splice(Math.max(0, i + numLayers), 0, SPRITE);
		}
	};

	// TODO: find a more descriptive name
	const moveToFrontBack = function (destination) {
		const i = self.children.indexOf(SPRITE);
		if (i !== -1) self.children.splice(i, 1);
		if (destination === 'front') {
			self.children.push(SPRITE);
		} else {
			self.children.unshift(SPRITE);
		}
	};

	const clone = function (name) {
		const parent = name === '_myself_' ? SPRITE : self.getObject(name);
		const c = parent.clone();
		self.children.splice(self.children.indexOf(parent), 0, c);
		self.triggerFor(c, 'whenCloned');
	};

	const epoch = Date.UTC(2000, 0, 1);

	const timeAndDate = P.Watcher.prototype.timeAndDate;

	const getVar = function (name) {
		return self.vars[name] === undefined ? SPRITE.vars[name] : self.vars[name];
	};

	const getList = function (name) {
		if (self.lists[name] !== undefined) return self.lists;
		if (SPRITE.lists[name] === undefined) {
			SPRITE.lists[name] = [];
		}
		return SPRITE.lists[name];
	};

	const listIndex = function (list, index, length) {
		const i = index | 0;
		if (i === index) return i > 0 && i <= length ? i - 1 : -1;
		if (index === 'random' || index === 'any') {
			return Math.random() * length | 0;
		}
		if (index === 'last') {
			return length - 1;
		}
		return i > 0 && i <= length ? i - 1 : -1;
	};

	const contentsOfList = function (list) {
		let isSingle = true;
		for (let i = list.length; i--;) {
			if (list[i].length !== 1) {
				isSingle = false;
				break;
			}
		}
		return list.join(isSingle ? '' : ' ');
	};

	const getLineOfList = function (list, index) {
		const i = listIndex(list, index, list.length);
		return i === -1 ? '' : list[i];
	};

	const listContains = function (list, value) {
		for (let i = list.length; i--;) {
			if (equal(list[i], value)) return true;
		}
		return false;
	};

	const appendToList = function (list, value) {
		list.push(value);
	};

	const deleteLineOfList = function (list, index) {
		if (index === 'all') {
			list.length = 0;
		} else {
			const i = listIndex(list, index, list.length);
			if (i === list.length - 1) {
				list.pop();
			} else if (i !== -1) {
				list.splice(i, 1);
			}
		}
	};

	const insertInList = function (list, index, value) {
		const i = listIndex(list, index, list.length + 1);
		if (i === list.length) {
			list.push(value);
		} else if (i !== -1) {
			list.splice(i, 0, value);
		}
	};

	const setLineOfList = function (list, index, value) {
		const i = listIndex(list, index, list.length);
		if (i !== -1) {
			list[i] = value;
		}
	};

	// TODO: figure out whether to attempt to emit code that will call this
	// Scratch 3.0 disallows dynamic mathop
	const mathFunc = function (f, x) {
		switch (f) {
			case 'abs':
				return Math.abs(x);
			case 'floor':
				return Math.floor(x);
			case 'sqrt':
				return Math.sqrt(x);
			case 'ceiling':
				return Math.ceil(x);
			case 'cos':
				return Math.cos(x * Math.PI / 180);
			case 'sin':
				return Math.sin(x * Math.PI / 180);
			case 'tan':
				return Math.tan(x * Math.PI / 180);
			case 'asin':
				return Math.asin(x) * 180 / Math.PI;
			case 'acos':
				return Math.acos(x) * 180 / Math.PI;
			case 'atan':
				return Math.atan(x) * 180 / Math.PI;
			case 'ln':
				return Math.log(x);
			case 'log':
				return Math.log(x) / Math.LN10;
			case 'e ^':
				return Math.exp(x);
			case '10 ^':
				return Math.exp(x * Math.LN10);
		}
		return 0;
	};

	const attribute = function (attr, objName) {
		const o = self.getObject(objName);
		if (!o) return 0;
		if (o.isSprite) {
			switch (attr) {
				case 'x position':
					return o.scratchX;
				case 'y position':
					return o.scratchY;
				case 'direction':
					return o.direction;
				case 'costume #':
					return o.currentCostumeIndex + 1;
				case 'costume name':
					return o.costumes[o.currentCostumeIndex].costumeName;
				case 'size':
					return o.scale * 100;
				case 'volume':
					return 0; // TODO
			}
		} else {
			switch (attr) {
				case 'background #':
				case 'backdrop #':
					return o.currentCostumeIndex + 1;
				case 'backdrop name':
					return o.costumes[o.currentCostumeIndex].costumeName;
				case 'volume':
					return 0; // TODO
			}
		}
		const value = o.vars[attr];
		if (value !== undefined) {
			return value;
		}
		return 0;
	};

	const VOLUME = 0.3;

	const audioContext = P.audioContext;
	if (audioContext) {
		var wavBuffers = P.IO.wavBuffers;

		var volumeNode = audioContext.createGain();
		volumeNode.gain.value = VOLUME;
		volumeNode.connect(audioContext.destination);

		var playNote = function (id, duration) {
			var spans = INSTRUMENTS[SPRITE.instrument];
			for (var i = 0, l = spans.length; i < l; i++) {
				var span = spans[i];
				if (span.top >= id || span.top === 128) break;
			}
			playSpan(span, Math.max(0, Math.min(127, id)), duration * 0.001);
		};

		var playSpan = function (span, id, duration) {
			if (!SPRITE.node) {
				SPRITE.node = audioContext.createGain();
				SPRITE.node.gain.value = SPRITE.volume;
				SPRITE.node.connect(volumeNode);
			}

			var source = audioContext.createBufferSource();
			var note = audioContext.createGain();
			var buffer = wavBuffers[span.name];
			if (!buffer) return;

			source.buffer = buffer;
			source.loop = span.loop;
			if (span.loop) {
				source.loopStart = span.loopStart;
				source.loopEnd = span.loopEnd;
			}

			source.connect(note);
			note.connect(SPRITE.node);

			var time = audioContext.currentTime;
			source.playbackRate.value = Math.pow(2, (id - 69) / 12) / span.baseRatio;

			var gain = note.gain;
			gain.value = 0;
			gain.setValueAtTime(0, time);
			if (span.attackEnd < duration) {
				gain.linearRampToValueAtTime(1, time + span.attackEnd);
				if (span.decayTime > 0 && span.holdEnd < duration) {
					gain.linearRampToValueAtTime(1, time + span.holdEnd);
					if (span.decayEnd < duration) {
						gain.linearRampToValueAtTime(0, time + span.decayEnd);
					} else {
						gain.linearRampToValueAtTime(1 - ((duration - span.holdEnd) / span.decayTime), time + duration);
					}
				} else {
					gain.linearRampToValueAtTime(1, time + duration);
				}
			} else {
				gain.linearRampToValueAtTime(1, time + duration);
			}
			gain.linearRampToValueAtTime(0, time + duration + 0.02267573696);

			source.start(time);
			source.stop(time + duration + 0.02267573696);
		};

		var playSound = function (sound) {
			if (!sound.buffer) return;
			if (!sound.node) {
				sound.node = audioContext.createGain();
				sound.node.gain.value = SPRITE.volume;
				sound.node.connect(volumeNode);
			}
			sound.target = SPRITE;
			sound.node.gain.setValueAtTime(SPRITE.volume, audioContext.currentTime);

			if (sound.source) {
				sound.source.disconnect();
			}
			sound.source = audioContext.createBufferSource();
			sound.source.buffer = sound.buffer;
			sound.source.connect(sound.node);

			sound.source.start(audioContext.currentTime);
		};
	}

	// Save the current stack frame to the stack, and create a new stack frame.
	const save = function () {
		STACK.push(STACK_FRAME);
		STACK_FRAME = {};
	};

	// Pop the last stack frame from the stack.
	const restore = function () {
		STACK_FRAME = STACK.pop();
	};

	// var lastCalls = [];
	const call = function (procedure, id, args) {
		// lastCalls.push(spec);
		// if (lastCalls.length > 10000) lastCalls.shift();
		if (procedure) {
			STACK.push(STACK_FRAME);
			STACK_FRAME = {};

			CALLS.push(C);
			C = {
				base: procedure.fn,
				fn: SPRITE.fns[id],
				args: args,
				argMap: procedure.inputs,
				stack: STACK = [],
				warp: procedure.warp
			};
			
			if (C.warp || WARP) {
				WARP++;
				IMMEDIATE = procedure.fn;
			} else {
				let recursive = false;
				for (let i = CALLS.length, j = 5; i-- && j--;) {
					if (CALLS[i].base === procedure.fn) {
						recursive = true;
						break;
					}
				}
				if (recursive) {
					self.queue[THREAD] = {
						sprite: SPRITE,
						base: BASE,
						fn: procedure.fn,
						calls: CALLS
					};
				} else {
					IMMEDIATE = procedure.fn;
				}
			}
		} else {
			IMMEDIATE = SPRITE.fns[id];
		}
	};

	const endCall = function () {
		if (CALLS.length) {
			if (WARP) WARP--;
			IMMEDIATE = C.fn;
			C = CALLS.pop();
			STACK = C.stack;
			STACK_FRAME = STACK.pop();
		}
	};

	const sceneChange = function () {
		return self.trigger('whenSceneStarts', self.costumes[self.currentCostumeIndex].costumeName);
	};

	const penClear = function () {
		self.penCanvas.width = 480 * self.maxZoom;
		self.penContext.scale(self.maxZoom, self.maxZoom);
		self.penContext.lineCap = 'round';
	};

	const broadcast = function (name) {
		return self.trigger('whenIReceive', name);
	};

	const stopOtherScripts = function () {
		for (let i = 0; i < self.queue.length; i++) {
			if (i !== THREAD && self.queue[i] && self.queue[i].sprite === SPRITE) {
				self.queue[i] = undefined;
			}
		}
	};

	const running = function (bases) {
		for (let j = 0; j < self.queue.length; j++) {
			if (self.queue[j] && bases.indexOf(self.queue[j].base) !== -1) return true;
		}
		return false;
	};

	const queue = function (id) {
		if (WARP) {
			IMMEDIATE = SPRITE.fns[id];
		} else {
			forceQueue(id);
		}
	};

	const forceQueue = function (id) {
		self.queue[THREAD] = {
			sprite: SPRITE,
			base: BASE,
			fn: SPRITE.fns[id],
			calls: CALLS
		};
	};

	// Internal definition
	(function () {
		'use strict';

		P.Stage.prototype.framerate = 30;
		P.Stage.prototype.frametime = 1000 / P.Stage.prototype.framerate;

		P.Stage.prototype.initRuntime = function () {
			this.queue = [];
			this.onError = this.onError.bind(this);
		};

		P.Stage.prototype.startThread = function (sprite, base) {
			const thread = {
				sprite: sprite,
				base: base,
				fn: base,
				calls: [{
					args: [],
					stack: [{}]
				}]
			};
			for (let i = 0; i < this.queue.length; i++) {
				const q = this.queue[i];
				if (q && q.sprite === sprite && q.base === base) {
					this.queue[i] = thread;
					return;
				}
			}
			this.queue.push(thread);
		};

		P.Stage.prototype.triggerFor = function (sprite, event, arg) {
			let threads;
			if (event === 'whenClicked') {
				threads = sprite.listeners.whenClicked;
			} else if (event === 'whenCloned') {
				threads = sprite.listeners.whenCloned;
			} else if (event === 'whenGreenFlag') {
				threads = sprite.listeners.whenGreenFlag;
			} else if (event === 'whenIReceive') {
				threads = sprite.listeners.whenIReceive[String(arg).toLowerCase()];
			} else if (event === 'whenKeyPressed') {
				threads = sprite.listeners.whenKeyPressed[arg];
			} else if (event === 'whenSceneStarts') {
				threads = sprite.listeners.whenSceneStarts[String(arg).toLowerCase()];
			}
			if (threads) {
				for (let i = 0; i < threads.length; i++) {
					this.startThread(sprite, threads[i]);
				}
			}
			return threads || [];
		};

		P.Stage.prototype.trigger = function (event, arg) {
			let threads = [];
			for (let i = this.children.length; i--;) {
				threads = threads.concat(this.triggerFor(this.children[i], event, arg));
			}
			return threads.concat(this.triggerFor(this, event, arg));
		};

		P.Stage.prototype.triggerGreenFlag = function () {
			this.timerStart = this.rightNow();
			this.trigger('whenGreenFlag');
		};

		P.Stage.prototype.start = function () {
			this.isRunning = true;
			if (this.interval) return;
			addEventListener('error', this.onError);
			this.baseTime = Date.now();
			this.interval = setInterval(this.step.bind(this), this.frametime);
			if (audioContext) audioContext.resume();
		};

		P.Stage.prototype.pause = function () {
			if (this.interval) {
				this.baseNow = this.rightNow();
				clearInterval(this.interval);
				delete this.interval;
				removeEventListener('error', this.onError);
				if (audioContext) audioContext.suspend();
			}
			this.isRunning = false;
		};

		P.Stage.prototype.stopAll = function () {
			this.hidePrompt = false;
			this.prompter.style.display = 'none';
			this.promptId = this.nextPromptId = 0;
			this.queue.length = 0;
			this.resetFilters();
			this.stopSounds();
			for (let i = 0; i < this.children.length; i++) {
				const c = this.children[i];
				if (c.isClone) {
					c.remove();
					i -= 1;
				} else {
					c.resetFilters();
					if (c.saying) c.say('');
					c.stopSounds();
				}
			}
		};

		P.Stage.prototype.rightNow = function () {
			return this.baseNow + Date.now() - this.baseTime;
		};

		P.Stage.prototype.step = function () {
			self = this;
			VISUAL = false;
			const start = Date.now();
			const queue = this.queue;
			let immedCounter = 0;
			do {
				this.now = this.rightNow();
				for (THREAD = 0; THREAD < queue.length; THREAD++) {
					if (queue[THREAD]) {
						SPRITE = queue[THREAD].sprite;
						IMMEDIATE = queue[THREAD].fn;
						BASE = queue[THREAD].base;
						CALLS = queue[THREAD].calls;
						C = CALLS.pop();
						STACK = C.stack;
						STACK_FRAME = STACK.pop();
						queue[THREAD] = undefined;
						WARP = 0;
						while (IMMEDIATE) {
							if (immedCounter++ > MAX_IMMEDIATE_CALLS) {
								console.error(
									`Immediate call overflow on ${SPRITE.objName}`,
									SPRITE,
									IMMEDIATE.toString()
								);
								break;
							}
							const fn = IMMEDIATE;
							IMMEDIATE = null;
							fn();
							
						}
						STACK.push(STACK_FRAME);
						CALLS.push(C);
					}
				}
				for (let i = queue.length; i--;) {
					if (!queue[i]) queue.splice(i, 1);
				}
			} while (
				(self.isTurbo || !VISUAL) &&
				Date.now() - start < this.frametime &&
				queue.length !== 0
			);
			this.draw();
			SPRITE = null;
		};

		P.Stage.prototype.onError = function (e) {
			this.handleError(e.error);
			clearInterval(this.interval);
		};

		P.Stage.prototype.handleError = function (e) {
			console.error(e.stack);
		};

	}());

	const instrumentConstants = require('../instrument-constants');

	const INSTRUMENTS = instrumentConstants.INSTRUMENTS;
	const DRUMS = instrumentConstants.DRUMS;

	return {
		scopedEval: function (source) {
			return eval(source);
		}
	};

});

module.exports = runtime;
