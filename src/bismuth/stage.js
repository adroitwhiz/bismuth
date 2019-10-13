const Base = require('./spritebase');
const Sprite = require('./sprite');
const Watcher = require('./watcher');

const SCALE = window.devicePixelRatio || 1;
const hasTouchEvents = 'ontouchstart' in document;

class Stage extends Base {
	constructor () {
		super();

		this.stage = this;

		this.children = [];
		this.allWatchers = [];
		this.dragging = Object.create(null);
		this.defaultWatcherX = 10;
		this.defaultWatcherY = 10;

		this.info = {};
		this.answer = '';
		this.promptId = 0;
		this.nextPromptId = 0;
		this.tempoBPM = 60;
		this.videoAlpha = 1;
		this.zoom = 1;
		this.maxZoom = SCALE;
		this.baseNow = 0;
		this.baseTime = 0;
		this.timerStart = 0;

		this.keys = [];
		this.keys.any = 0;
		this.rawMouseX = 0;
		this.rawMouseY = 0;
		this.mouseX = 0;
		this.mouseY = 0;
		this.mousePressed = false;

		this.root = document.createElement('div');
		this.root.style.position = 'absolute';
		this.root.style.overflow = 'hidden';
		this.root.style.width = '480px';
		this.root.style.height = '360px';
		this.root.style.fontSize = '10px';
		this.root.style.background = '#fff';
		this.root.style.contain = 'strict';
		this.root.style.MozUserSelect =
		this.root.style.MSUserSelect =
		this.root.style.WebkitUserSelect = 'none';

		this.backdropCanvas = document.createElement('canvas');
		this.root.appendChild(this.backdropCanvas);
		this.backdropCanvas.width = SCALE * 480;
		this.backdropCanvas.height = SCALE * 360;
		this.backdropContext = this.backdropCanvas.getContext('2d');

		this.penCanvas = document.createElement('canvas');
		this.root.appendChild(this.penCanvas);
		this.penCanvas.width = SCALE * 480;
		this.penCanvas.height = SCALE * 360;
		this.penContext = this.penCanvas.getContext('2d');
		this.penContext.lineCap = 'round';
		this.penContext.scale(SCALE, SCALE);

		this.canvas = document.createElement('canvas');
		this.root.appendChild(this.canvas);
		this.canvas.width = SCALE * 480;
		this.canvas.height = SCALE * 360;
		this.context = this.canvas.getContext('2d');

		this.ui = document.createElement('div');
		this.root.appendChild(this.ui);
		this.ui.style.pointerEvents = 'none';
		this.ui.style.contain = 'strict';

		this.canvas.tabIndex = 0;
		this.canvas.style.outline = 'none';
		this.backdropCanvas.style.position =
		this.penCanvas.style.position =
		this.canvas.style.position =
		this.ui.style.position = 'absolute';
		this.backdropCanvas.style.left =
		this.penCanvas.style.left =
		this.canvas.style.left =
		this.ui.style.left =
		this.backdropCanvas.style.top =
		this.penCanvas.style.top =
		this.canvas.style.top =
		this.ui.style.top = 0;
		this.backdropCanvas.style.width =
		this.penCanvas.style.width =
		this.canvas.style.width =
		this.ui.style.width = '480px';
		this.backdropCanvas.style.height =
		this.penCanvas.style.height =
		this.canvas.style.height =
		this.ui.style.height = '360px';

		this.backdropCanvas.style.transform =
		this.penCanvas.style.transform =
		this.canvas.style.transform =
		this.ui.style.transform = 'translateZ(0)';

		this.root.addEventListener('keydown', e => {
			const c = e.keyCode;
			if (!this.keys[c]) this.keys.any++;
			this.keys[c] = true;
			if (e.ctrlKey || e.altKey || e.metaKey || c === 27) return;
			e.stopPropagation();
			if (e.target === this.canvas) {
				e.preventDefault();
				this.trigger('whenKeyPressed', c);
			}
		});

		this.root.addEventListener('keyup', e => {
			const c = e.keyCode;
			if (this.keys[c]) this.keys.any--;
			this.keys[c] = false;
			e.stopPropagation();
			if (e.target === this.canvas) {
				e.preventDefault();
			}
		});

		if (hasTouchEvents) {

			document.addEventListener('touchstart', this.onTouchStart = e => {
				this.mousePressed = true;
				for (let i = 0; i < e.changedTouches.length; i++) {
					const t = e.changedTouches[i];
					this.updateMouse(t);
					if (e.target === this.canvas) {
						this.clickMouse();
					} else if (e.target.dataset.button != null || e.target.dataset.slider != null) {
						this.watcherStart(t.identifier, t, e);
					}
				}
				if (e.target === this.canvas) e.preventDefault();
			});

			document.addEventListener('touchmove', this.onTouchMove = e => {
				this.updateMouse(e.changedTouches[0]);
				for (let i = 0; i < e.changedTouches.length; i++) {
					const t = e.changedTouches[i];
					this.watcherMove(t.identifier, t, e);
				}
			});

			document.addEventListener('touchend', this.onTouchEnd = e => {
				this.releaseMouse();
				for (let i = 0; i < e.changedTouches.length; i++) {
					const t = e.changedTouches[i];
					this.watcherEnd(t.identifier, t, e);
				}
			});

		} else {

			document.addEventListener('mousedown', this.onMouseDown = e => {
				this.updateMouse(e);
				this.mousePressed = true;

				if (e.target === this.canvas) {
					this.clickMouse();
					e.preventDefault();
					this.canvas.focus();
				} else {
					if (e.target.dataset.button != null || e.target.dataset.slider != null) {
						this.watcherStart('mouse', e, e);
					}
					if (e.target !== this.prompt) setTimeout(() => {
						this.canvas.focus();
					});
				}
			});

			document.addEventListener('mousemove', this.onMouseMove = e => {
				this.updateMouse(e);
				this.watcherMove('mouse', e, e);
			});

			document.addEventListener('mouseup', this.onMouseUp = e => {
				this.updateMouse(e);
				this.releaseMouse();
				this.watcherEnd('mouse', e, e);
			});
		}

		this.prompter = document.createElement('div');
		this.ui.appendChild(this.prompter);
		this.prompter.style.zIndex = '1';
		this.prompter.style.pointerEvents = 'auto';
		this.prompter.style.position = 'absolute';
		this.prompter.style.left =
		this.prompter.style.right = '1.4em';
		this.prompter.style.bottom = '.6em';
		this.prompter.style.padding = '.5em 3.0em .5em .5em';
		this.prompter.style.border = '.3em solid rgb(46, 174, 223)';
		this.prompter.style.borderRadius = '.8em';
		this.prompter.style.background = '#fff';
		this.prompter.style.display = 'none';

		this.promptTitle = document.createElement('div');
		this.prompter.appendChild(this.promptTitle);
		this.promptTitle.textContent = '';
		this.promptTitle.style.cursor = 'default';
		this.promptTitle.style.font = 'bold 1.3em sans-serif';
		this.promptTitle.style.margin = `0 ${-25 / 13}em ${5 / 13}em 0`;
		this.promptTitle.style.whiteSpace = 'pre';
		this.promptTitle.style.overflow = 'hidden';
		this.promptTitle.style.textOverflow = 'ellipsis';

		this.prompt = document.createElement('input');
		this.prompter.appendChild(this.prompt);
		this.prompt.style.border = '0';
		this.prompt.style.background = '#eee';
		this.prompt.style.MozBoxSizing =
		this.prompt.style.boxSizing = 'border-box';
		this.prompt.style.font = '1.3em sans-serif';
		this.prompt.style.padding = `0 ${3 / 13}em`;
		this.prompt.style.outline = '0';
		this.prompt.style.margin = '0';
		this.prompt.style.width = '100%';
		this.prompt.style.height = `${20 / 13}em`;
		this.prompt.style.display = 'block';
		this.prompt.style.WebkitBorderRadius =
		this.prompt.style.borderRadius = '0';
		this.prompt.style.WebkitBoxShadow =
		this.prompt.style.boxShadow = `inset ${1 / 13}em ${1 / 13}em ${2 / 13}em rgba(0, 0, 0, .2), inset ${-1 / 13}em ${-1 / 13}em ${1 / 13}em rgba(255, 255, 255, .2)`;
		this.prompt.style.WebkitAppearance = 'none';

		this.promptButton = document.createElement('div');
		this.prompter.appendChild(this.promptButton);
		this.promptButton.style.width = '2.2em';
		this.promptButton.style.height = '2.2em';
		this.promptButton.style.position = 'absolute';
		this.promptButton.style.right = '.4em';
		this.promptButton.style.bottom = '.4em';
		this.promptButton.style.background = 'url(icons.svg) -16.5em -3.7em';
		this.promptButton.style.backgroundSize = '32.0em 9.6em';

		this.prompt.addEventListener('keydown', e => {
			if (e.keyCode === 13) {
				this.submitPrompt();
			}
		});

		this.promptButton.addEventListener(hasTouchEvents ? 'touchstart' : 'mousedown', this.submitPrompt.bind(this));

		this.initRuntime();
	}

	watcherStart (id, t, e) {
		let p = e.target;
		while (p && p.dataset.watcher == null) p = p.parentElement;
		if (!p) return;
		const w = this.allWatchers[p.dataset.watcher];
		this.dragging[id] = {
			watcher: w,
			offset: (e.target.dataset.button == null ?
				-w.button.offsetWidth / 2 | 0 :
				w.button.getBoundingClientRect().left - t.clientX) - w.slider.getBoundingClientRect().left
		};
	}

	watcherMove (id, t, e) {
		const d = this.dragging[id];
		if (!d) return;
		const w = d.watcher;
		const sw = w.slider.offsetWidth;
		const bw = w.button.offsetWidth;
		const value = w.sliderMin + (
			Math.max(0, Math.min(1, (t.clientX + d.offset) / (sw - bw))) * (w.sliderMax - w.sliderMin)
		);
		w.target.vars[w.param] = w.isDiscrete ? Math.round(value) : Math.round(value * 100) / 100;
		w.update();
		e.preventDefault();
	}

	watcherEnd (id, t, e) {
		this.watcherMove(id, t, e);
		delete this.dragging[id];
	}

	destroy () {
		this.stopAll();
		this.pause();
		if (this.onTouchStart) document.removeEventListener('touchstart', this.onTouchStart);
		if (this.onTouchMove) document.removeEventListener('touchmove', this.onTouchMove);
		if (this.onTouchEnd) document.removeEventListener('touchend', this.onTouchEnd);
		if (this.onMouseDown) document.removeEventListener('mousedown', this.onMouseDown);
		if (this.onMouseMove) document.removeEventListener('mousemove', this.onMouseMove);
		if (this.onMouseUp) document.removeEventListener('mouseup', this.onMouseUp);
	}

	focus () {
		if (this.promptId < this.nextPromptId) {
			this.prompt.focus();
		} else {
			this.canvas.focus();
		}
	}

	updateMouse (e) {
		const bb = this.canvas.getBoundingClientRect();
		let x = ((e.clientX - bb.left) / this.zoom) - 240;
		let y = 180 - ((e.clientY - bb.top) / this.zoom);
		this.rawMouseX = x;
		this.rawMouseY = y;
		if (x < -240) x = -240;
		if (x > 240) x = 240;
		if (y < -180) y = -180;
		if (y > 180) y = 180;
		this.mouseX = x;
		this.mouseY = y;
	}

	updateBackdrop () {
		this.backdropCanvas.width = this.zoom * SCALE * 480;
		this.backdropCanvas.height = this.zoom * SCALE * 360;
		const costume = this.costumes[this.currentCostumeIndex];
		this.backdropContext.save();
		const s = this.zoom * SCALE * costume.scale;
		this.backdropContext.scale(s, s);
		this.backdropContext.drawImage(costume.image, 0, 0);
		this.backdropContext.restore();
	}

	updateFilters () {
		this.backdropCanvas.style.opacity = Math.max(0, Math.min(1, 1 - (this.filters.ghost / 100)));
	}

	setZoom (zoom) {
		if (this.zoom === zoom) return;
		if (this.maxZoom < zoom * SCALE) {
			this.maxZoom = zoom * SCALE;
			const canvas = document.createElement('canvas');
			canvas.width = this.penCanvas.width;
			canvas.height = this.penCanvas.height;
			canvas.getContext('2d').drawImage(this.penCanvas, 0, 0);
			this.penCanvas.width = 480 * zoom * SCALE;
			this.penCanvas.height = 360 * zoom * SCALE;
			this.penContext.drawImage(canvas, 0, 0, 480 * zoom * SCALE, 360 * zoom * SCALE);
			this.penContext.scale(this.maxZoom, this.maxZoom);
			this.penContext.lineCap = 'round';
		}
		this.root.style.width =
		this.canvas.style.width =
		this.backdropCanvas.style.width =
		this.penCanvas.style.width =
		this.ui.style.width = `${480 * zoom | 0}px`;
		this.root.style.height =
		this.canvas.style.height =
		this.backdropCanvas.style.height =
		this.penCanvas.style.height =
		this.ui.style.height = `${360 * zoom | 0}px`;
		this.root.style.fontSize = `${zoom * 10}px`;
		this.zoom = zoom;
		this.updateBackdrop();
	}

	clickMouse () {
		this.mouseSprite = undefined;
		for (let i = this.children.length; i--;) {
			const c = this.children[i];
			if (c.visible && c.filters.ghost < 100 && c.touching('_mouse_')) {
				if (c.isDraggable) {
					this.mouseSprite = c;
					c.mouseDown();
				} else {
					this.triggerFor(c, 'whenClicked');
				}
				return;
			}
		}
		this.triggerFor(this, 'whenClicked');
	}

	releaseMouse () {
		this.mousePressed = false;
		if (this.mouseSprite) {
			this.mouseSprite.mouseUp();
			this.mouseSprite = undefined;
		}
	}

	stopAllSounds () {
		for (let children = this.children, i = children.length; i--;) {
			children[i].stopSounds();
		}
		this.stopSounds();
	}

	removeAllClones () {
		let i = this.children.length;
		while (i--) {
			if (this.children[i].isClone) {
				this.children[i].remove();
			}
		}
	}

	getObject (name) {
		for (let i = 0; i < this.children.length; i++) {
			const c = this.children[i];
			if (c.objName === name && !c.isClone) {
				return c;
			}
		}
		if (name === '_stage_' || name === this.objName) {
			return this;
		}
	}

	getObjects (name) {
		const result = [];
		for (let i = 0; i < this.children.length; i++) {
			if (this.children[i].objName === name) {
				result.push(this.children[i]);
			}
		}
		return result;
	}

	draw () {
		const context = this.context;

		this.canvas.width = 480 * this.zoom * SCALE; // clear
		this.canvas.height = 360 * this.zoom * SCALE;

		context.scale(this.zoom * SCALE, this.zoom * SCALE);
		this.drawOn(context);
		for (let i = this.allWatchers.length; i--;) {
			const w = this.allWatchers[i];
			if (w.visible) w.update();
		}

		if (this.hidePrompt) {
			this.hidePrompt = false;
			this.prompter.style.display = 'none';
			this.canvas.focus();
		}
	}

	drawOn (context, except) {
		for (let i = 0; i < this.children.length; i++) {
			const c = this.children[i];
			if (c.visible && c !== except) {
				c.draw(context);
			}
		}
	}

	drawAllOn (context, except) {
		const costume = this.costumes[this.currentCostumeIndex];
		context.save();
		context.scale(costume.scale, costume.scale);
		context.globalAlpha = Math.max(0, Math.min(1, 1 - (this.filters.ghost / 100)));
		context.drawImage(costume.image, 0, 0);
		context.restore();

		context.save();
		context.scale(1 / this.maxZoom, 1 / this.maxZoom);
		context.drawImage(this.penCanvas, 0, 0);
		context.restore();

		this.drawOn(context, except);
	}

	moveTo () {}

	submitPrompt () {
		if (this.promptId < this.nextPromptId) {
			this.answer = this.prompt.value;
			this.promptId += 1;
			if (this.promptId >= this.nextPromptId) {
				this.hidePrompt = true;
			}
		}
	}
}

Stage.prototype.isStage = true;

module.exports = Stage;
