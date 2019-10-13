const Base = require('./spritebase');
const Color = require('./util/color');

const SCALE = window.devicePixelRatio || 1;

class Sprite extends Base {
	constructor (stage) {
		super();

		this.stage = stage;

		this.direction = 90;
		this.indexInLibrary = -1;
		this.isDraggable = false;
		this.isDragging = false;
		this.rotationStyle = 'normal';
		this.scale = 1;
		this.scratchX = 0;
		this.scratchY = 0;
		this.visible = true;

		this.penState = {
			penDown: false,
			hue: 200 / 3,
			saturation: 100,
			value: 100,
			transparency: 0,
			colorNumeric: null,
			_shade: 50, // Used by Scratch 2.0 'pen shade' blocks
			diameter: 1,

			penCSS: null
		};
		this.updatePenCSS();

		this.isSprite = true;
		this.bubble = null;
		this.saying = false;
		this.thinking = false;
		this.sayId = 0;
	}

	clone () {
		const c = new Sprite(this.stage);

		c.isClone = true;
		c.costumes = this.costumes;
		c.currentCostumeIndex = this.currentCostumeIndex;
		c.objName = this.objName;
		c.soundRefs = this.soundRefs;
		c.sounds = this.sounds;

		{
			const keys = Object.keys(this.vars);
			for (let i = 0; i < keys.length; i++) {
				const k = keys[i];
				c.vars[k] = this.vars[k];
			}
		}

		{
			const keys = Object.keys(this.lists);
			for (let i = 0; i < keys.length; i++) {
				const k = keys[i];
				c.lists[k] = this.lists[k].slice(0);
			}
		}

		c.procedures = this.procedures;
		c.listeners = this.listeners;
		c.fns = this.fns;
		c.scripts = this.scripts;

		c.filters = {
			color: this.filters.color,
			fisheye: this.filters.fisheye,
			whirl: this.filters.whirl,
			pixelate: this.filters.pixelate,
			mosaic: this.filters.mosaic,
			brightness: this.filters.brightness,
			ghost: this.filters.ghost
		};

		c.direction = this.direction;
		c.instrument = this.instrument;
		c.indexInLibrary = this.indexInLibrary;
		c.isDraggable = this.isDraggable;
		c.rotationStyle = this.rotationStyle;
		c.scale = this.scale;
		c.volume = this.volume;
		c.scratchX = this.scratchX;
		c.scratchY = this.scratchY;
		c.visible = this.visible;

		{
			const keys = Object.keys(this.penState);
			for (let i = 0; i < keys.length; i++) {
				const key = keys[i];
				c.penState[key] = this.penState[key];
			}
		}

		return c;
	}

	mouseDown () {
		this.dragStartX = this.scratchX;
		this.dragStartY = this.scratchY;
		this.dragOffsetX = this.scratchX - this.stage.mouseX;
		this.dragOffsetY = this.scratchY - this.stage.mouseY;
		this.isDragging = true;
	}

	mouseUp () {
		if (this.isDragging && this.scratchX === this.dragStartX && this.scratchY === this.dragStartY) {
			this.stage.triggerFor(this, 'whenClicked');
		}
		this.isDragging = false;
	}

	forward (steps) {
		const d = (90 - this.direction) * Math.PI / 180;
		this.moveTo(this.scratchX + (steps * Math.cos(d)), this.scratchY + (steps * Math.sin(d)));
	}

	moveTo (x, y) {
		const ox = this.scratchX;
		const oy = this.scratchY;
		if (ox === x && oy === y && !this.penState.penDown) return;
		this.scratchX = x;
		this.scratchY = y;
		if (this.penState.penDown && !this.isDragging) {
			this.penLine(ox, oy, x, y);
		}
		if (this.saying) {
			this.updateBubble();
		}
	}

	setPenHSVFromNumeric () {
		const penState = this.penState;
		const hsv = Color.rgbToHsv(penState.colorNumeric);
		penState.hue = hsv[0] / 3.6;
		penState.saturation = hsv[1] * 100;
		penState.value = hsv[2] * 100;
		penState._shade = Color.rgbToLightness(penState.colorNumeric);
		penState.colorNumeric = null;
	}

	setPenColorLegacy (color) {
		const penState = this.penState;
		color = color % 200;
		if (color < 0) color += 200;
		const wrappedShade = (penState._shade > 100) ? 200 - penState._shade : penState._shade;
		const hsv = Color.hslToHsv(color * 1.8, 1, wrappedShade / 100);
		penState.hue = color * 0.5;
		penState.saturation = hsv[1] * 100;
		penState.value = hsv[2] * 100;
	}

	setPenShadeLegacy (shade) {
		const penState = this.penState;
		shade = shade % 200;
		if (shade < 0) shade += 200;
		const wrappedShade = (shade > 100) ? 200 - shade : shade;
		const hsv = Color.hslToHsv(penState.hue, 1, wrappedShade / 100);
		penState.saturation = hsv[1] * 100;
		penState.value = hsv[2] * 100;
		penState._shade = shade;
	}

	updatePenCSS () {
		const penState = this.penState;
		const colorNum = penState.colorNumeric;
		if (colorNum === null) {
			const penRGB = Color.hsvToRgb(penState.hue * 3.6, penState.saturation / 100, penState.value / 100);
			/* eslint-disable-next-line max-len */
			penState.penCSS = `rgba(${penRGB[0] * 255}, ${penRGB[1] * 255}, ${penRGB[2] * 255}, ${1 - (penState.transparency / 100)})`;

		} else {
			/* eslint-disable-next-line max-len */
			penState.penCSS = `rgba(${(colorNum >> 16) & 0xff}, ${(colorNum >> 8) & 0xff}, ${colorNum & 0xff}, ${(((colorNum >> 24) & 0xff) / 0xff) || 1})`;
		}
	}

	penDot () {
		const context = this.stage.penContext;
		const x = this.scratchX;
		const y = this.scratchY;
		context.fillStyle = this.penState.penCSS;
		context.beginPath();
		context.arc(240 + x, 180 - y, this.penState.diameter / 2, 0, 2 * Math.PI, false);
		context.fill();
	}

	penLine (ox, oy, x, y) {
		const context = this.stage.penContext;
		if (this.penState.diameter % 2 > .5 && this.penState.diameter % 2 < 1.5) {
			ox -= .5;
			oy -= .5;
			x -= .5;
			y -= .5;
		}
		context.strokeStyle = this.penState.penCSS;
		context.lineWidth = this.penState.diameter;
		context.beginPath();
		context.moveTo(240 + ox, 180 - oy);
		context.lineTo(240 + x, 180 - y);
		context.stroke();
	}

	penStamp () {
		this.draw(this.stage.penContext);
	}

	draw (context, noEffects) {
		const costume = this.costumes[this.currentCostumeIndex];

		if (this.isDragging) {
			this.moveTo(this.dragOffsetX + this.stage.mouseX, this.dragOffsetY + this.stage.mouseY);
		}

		if (costume) {
			context.save();

			const z = this.stage.zoom * SCALE;
			context.translate(((this.scratchX + 240) * z | 0) / z, ((180 - this.scratchY) * z | 0) / z);
			if (this.rotationStyle === 'normal') {
				context.rotate((this.direction - 90) * Math.PI / 180);
			} else if (this.rotationStyle === 'leftRight' && this.direction < 0) {
				context.scale(-1, 1);
			}
			context.scale(this.scale, this.scale);
			context.scale(costume.scale, costume.scale);
			context.translate(-costume.rotationCenterX, -costume.rotationCenterY);

			if (!noEffects) context.globalAlpha = Math.max(0, Math.min(1, 1 - (this.filters.ghost / 100)));

			context.drawImage(costume.image, 0, 0);

			context.restore();
		}
	}

	setDirection (degrees) {
		let d = degrees % 360;
		if (d > 180) d -= 360;
		if (d <= -180) d += 360;
		this.direction = d;
		if (this.saying) this.updateBubble();
	}

	touching (thing) {
		const costume = this.costumes[this.currentCostumeIndex];

		if (thing === '_mouse_') {
			const bounds = this.rotatedBounds();
			const x = this.stage.rawMouseX;
			const y = this.stage.rawMouseY;
			if (x < bounds.left || y < bounds.bottom || x > bounds.right || y > bounds.top) {
				return false;
			}
			let cx = (x - this.scratchX) / this.scale;
			let cy = (this.scratchY - y) / this.scale;
			if (this.rotationStyle === 'normal' && this.direction !== 90) {
				const directionRadians = (90 - this.direction) * Math.PI / 180;
				const ox = cx;
				const s = Math.sin(directionRadians);
				const c = Math.cos(directionRadians);
				cx = (c * ox) - (s * cy);
				cy = (s * ox) + (c * cy);
			} else if (this.rotationStyle === 'leftRight' && this.direction < 0) {
				cx = -cx;
			}
			const costumeImageData = costume.context.getImageData(
				(cx * costume.bitmapResolution) + costume.rotationCenterX,
				(cy * costume.bitmapResolution) + costume.rotationCenterY,
				1, 1
			).data;
			return costumeImageData[3] !== 0;
		} else if (thing === '_edge_') {
			const bounds = this.rotatedBounds();
			return bounds.left <= -240 || bounds.right >= 240 || bounds.top >= 180 || bounds.bottom <= -180;
		} else {
			if (!this.visible) return false;
			const sprites = this.stage.getObjects(thing);
			for (let i = sprites.length; i--;) {
				const sprite = sprites[i];
				if (!sprite.visible) continue;

				const mb = this.rotatedBounds();
				const ob = sprite.rotatedBounds();

				if (mb.bottom >= ob.top || ob.bottom >= mb.top || mb.left >= ob.right || ob.left >= mb.right) {
					continue;
				}

				const left = Math.max(mb.left, ob.left);
				const top = Math.min(mb.top, ob.top);
				const right = Math.min(mb.right, ob.right);
				const bottom = Math.max(mb.bottom, ob.bottom);

				collisionCanvas.width = right - left;
				collisionCanvas.height = top - bottom;

				collisionContext.save();
				collisionContext.translate(-(left + 240), -(180 - top));

				this.draw(collisionContext, true);
				collisionContext.globalCompositeOperation = 'source-in';
				sprite.draw(collisionContext, true);

				collisionContext.restore();

				const data = collisionContext.getImageData(0, 0, right - left, top - bottom).data;

				const length = (right - left) * (top - bottom) * 4;
				for (let j = 0; j < length; j += 4) {
					if (data[j + 3]) {
						return true;
					}
				}
			}
			return false;
		}
	}

	touchingColor (rgb) {
		const b = this.rotatedBounds();
		collisionCanvas.width = b.right - b.left;
		collisionCanvas.height = b.top - b.bottom;

		collisionContext.save();
		collisionContext.translate(-(240 + b.left), -(180 - b.top));

		this.stage.drawAllOn(collisionContext, this);
		collisionContext.globalCompositeOperation = 'destination-in';
		this.draw(collisionContext, true);

		collisionContext.restore();

		const data = collisionContext.getImageData(0, 0, b.right - b.left, b.top - b.bottom).data;

		rgb = rgb & 0xffffff;
		const length = (b.right - b.left) * (b.top - b.bottom) * 4;
		for (let i = 0; i < length; i += 4) {
			if (((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]) === rgb && data[i + 3]) {
				return true;
			}
		}

		return false;
	}

	/* eslint-disable-next-line no-unused-vars */
	colorIsTouchingColor (color, mask) {
		// TODO
		return false;
	}

	bounceOffEdge () {
		let b = this.rotatedBounds();
		const dl = 240 + b.left;
		const dt = 180 - b.top;
		const dr = 240 - b.right;
		const db = 180 + b.bottom;

		const d = Math.min(dl, dt, dr, db);
		if (d > 0) return;

		const dir = this.direction * Math.PI / 180;
		let dx = Math.sin(dir);
		let dy = -Math.cos(dir);

		switch (d) {
			case dl: dx = Math.max(0.2, Math.abs(dx)); break;
			case dt: dy = Math.max(0.2, Math.abs(dy)); break;
			case dr: dx = -Math.max(0.2, Math.abs(dx)); break;
			case db: dy = -Math.max(0.2, Math.abs(dy)); break;
		}

		this.direction = (Math.atan2(dy, dx) * 180 / Math.PI) + 90;
		if (this.saying) this.updateBubble();

		// TODO: figure out what this is supposed to do
		b = this.rotatedBounds();
		let x = this.scratchX;
		let y = this.scratchY;
		if (b.left < -240) x += -240 - b.left;
		if (b.top > 180) y += 180 - b.top;
		if (b.right > 240) x += 240 - b.left;
		if (b.bottom < -180) y += -180 - b.top;
	}

	rotatedBounds () {
		const costume = this.costumes[this.currentCostumeIndex];

		const s = costume.scale * this.scale;
		let left = -costume.rotationCenterX * s;
		const top = costume.rotationCenterY * s;
		let right = left + (costume.image.width * s);
		const bottom = top - (costume.image.height * s);

		if (this.rotationStyle !== 'normal') {
			if (this.rotationStyle === 'leftRight' && this.direction < 0) {
				right = -left;
				left = right - (costume.image.width * costume.scale * this.scale);
			}
			return {
				left: this.scratchX + left,
				right: this.scratchX + right,
				top: this.scratchY + top,
				bottom: this.scratchY + bottom
			};
		}

		const mSin = Math.sin(this.direction * Math.PI / 180);
		const mCos = Math.cos(this.direction * Math.PI / 180);

		const tlX = (mSin * left) - (mCos * top);
		const tlY = (mCos * left) + (mSin * top);

		const trX = (mSin * right) - (mCos * top);
		const trY = (mCos * right) + (mSin * top);

		const blX = (mSin * left) - (mCos * bottom);
		const blY = (mCos * left) + (mSin * bottom);

		const brX = (mSin * right) - (mCos * bottom);
		const brY = (mCos * right) + (mSin * bottom);

		return {
			left: this.scratchX + Math.min(tlX, trX, blX, brX),
			right: this.scratchX + Math.max(tlX, trX, blX, brX),
			top: this.scratchY + Math.max(tlY, trY, blY, brY),
			bottom: this.scratchY + Math.min(tlY, trY, blY, brY)
		};
	}

	showRotatedBounds () {
		const bounds = this.rotatedBounds();
		const div = document.createElement('div');
		div.style.outline = '1px solid red';
		div.style.position = 'absolute';
		div.style.left = `${240 + bounds.left}px`;
		div.style.top = `${180 - bounds.top}px`;
		div.style.width = `${bounds.right - bounds.left}px`;
		div.style.height = `${bounds.top - bounds.bottom}px`;
		this.stage.canvas.parentNode.appendChild(div);
	}

	distanceTo (thing) {
		let x, y;
		if (thing === '_mouse_') {
			x = this.stage.mouseX;
			y = this.stage.mouseY;
		} else {
			const sprite = this.stage.getObject(thing);
			if (!sprite) return 10000;
			x = sprite.scratchX;
			y = sprite.scratchY;
		}
		return Math.sqrt(((this.scratchX - x) * (this.scratchX - x)) + ((this.scratchY - y) * (this.scratchY - y)));
	}

	gotoObject (thing) {
		if (thing === '_mouse_') {
			this.moveTo(this.stage.mouseX, this.stage.mouseY);
		} else if (thing === '_random_') {
			const x = Math.round((480 * Math.random()) - 240);
			const y = Math.round((360 * Math.random()) - 180);
			this.moveTo(x, y);
		} else {
			const sprite = this.stage.getObject(thing);
			if (!sprite) return 0;
			this.moveTo(sprite.scratchX, sprite.scratchY);
		}
	}

	pointTowards (thing) {
		let x, y;
		if (thing === '_mouse_') {
			x = this.stage.mouseX;
			y = this.stage.mouseY;
		} else {
			const sprite = this.stage.getObject(thing);
			if (!sprite) return 0;
			x = sprite.scratchX;
			y = sprite.scratchY;
		}
		const dx = x - this.scratchX;
		const dy = y - this.scratchY;
		this.direction = dx === 0 && dy === 0 ? 90 : Math.atan2(dx, dy) * 180 / Math.PI;
		if (this.saying) this.updateBubble();
	}

	say (text, thinking) {
		if (text === '' || text === null) {
			this.saying = false;
			if (!this.bubble) return;
			this.bubble.style.display = 'none';
			return ++this.sayId;
		}
		text = String(text);
		this.saying = true;
		this.thinking = thinking;
		if (!this.bubble) {
			this.bubble = document.createElement('div');
			this.bubble.style.maxWidth = `${127 / 14}em`;
			this.bubble.style.minWidth = `${48 / 14}em`;
			this.bubble.style.padding = `${8 / 14}em ${10 / 14}em`;
			this.bubble.style.border = `${3 / 14}em solid rgb(160, 160, 160)`;
			this.bubble.style.borderRadius = `${10 / 14}em`;
			this.bubble.style.background = '#fff';
			this.bubble.style.position = 'absolute';
			this.bubble.style.font = 'bold 1.4em sans-serif';
			this.bubble.style.whiteSpace = 'pre-wrap';
			this.bubble.style.wordWrap = 'break-word';
			this.bubble.style.textAlign = 'center';
			this.bubble.style.cursor = 'default';
			this.bubble.style.pointerEvents = 'auto';
			this.bubble.appendChild(this.bubbleText = document.createTextNode(''));
			this.bubble.appendChild(this.bubblePointer = document.createElement('div'));
			this.bubblePointer.style.position = 'absolute';
			this.bubblePointer.style.height = `${21 / 14}em`;
			this.bubblePointer.style.width = `${44 / 14}em`;
			this.bubblePointer.style.background = `url(icons.svg) ${-195 / 14}em ${-4 / 14}em`;
			this.bubblePointer.style.backgroundSize = `${320 / 14}em ${96 / 14}em`;
			this.stage.ui.appendChild(this.bubble);
		}
		this.bubblePointer.style.backgroundPositionX = `${(thinking ? -259 : -195) / 14}em`;
		this.bubble.style.display = 'block';
		this.bubbleText.nodeValue = text;
		this.updateBubble();
		return ++this.sayId;
	}

	updateBubble () {
		if (!this.visible || !this.saying) {
			this.bubble.style.display = 'none';
			return;
		}
		const b = this.rotatedBounds();
		const left = 240 + b.right;
		let bottom = 180 + b.top;
		const width = this.bubble.offsetWidth / this.stage.zoom;
		const height = this.bubble.offsetHeight / this.stage.zoom;
		this.bubblePointer.style.top = `${(height - 6) / 14}em`;
		if (left + width + 2 > 480) {
			this.bubble.style.right = `${(240 - b.left) / 14}em`;
			this.bubble.style.left = 'auto';
			this.bubblePointer.style.right = `${3 / 14}em`;
			this.bubblePointer.style.left = 'auto';
			this.bubblePointer.style.backgroundPositionY = `${-36 / 14}em`;
		} else {
			this.bubble.style.left = `${left / 14}em`;
			this.bubble.style.right = 'auto';
			this.bubblePointer.style.left = `${3 / 14}em`;
			this.bubblePointer.style.right = 'auto';
			this.bubblePointer.style.backgroundPositionY = `${-4 / 14}em`;
		}
		if (bottom + height + 2 > 360) {
			bottom = 360 - height - 2;
		}
		if (bottom < 19) {
			bottom = 19;
		}
		this.bubble.style.bottom = `${bottom / 14}em`;
	}

	remove () {
		if (this.bubble) {
			this.stage.ui.removeChild(this.bubble);
			this.bubble = null;
		}
		if (this.node) {
			this.node.disconnect();
			this.node = null;
		}
		const children = this.stage.children;
		const spriteIndex = children.indexOf(this);
		if (spriteIndex !== -1) children.splice(spriteIndex, 1);
	}
}

const collisionCanvas = document.createElement('canvas');
const collisionContext = collisionCanvas.getContext('2d');

module.exports = Sprite;
