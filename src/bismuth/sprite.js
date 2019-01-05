const inherits = require("./inherits");
const Base = require("./spritebase");

var SCALE = window.devicePixelRatio || 1;

var Sprite = function(stage) {
  this.stage = stage;

  Sprite.parent.call(this);

  this.direction = 90;
  this.indexInLibrary = -1;
  this.isDraggable = false;
  this.isDragging = false;
  this.rotationStyle = 'normal';
  this.scale = 1;
  this.scratchX = 0;
  this.scratchY = 0;
  this.spriteInfo = {};
  this.visible = true;

  this.penHue = 240;
  this.penSaturation = 100;
  this.penLightness = 50;

  this.penSize = 1;
  this.isPenDown = false;
  this.isSprite = true;
  this.bubble = null;
  this.saying = false;
  this.thinking = false;
  this.sayId = 0;
};
inherits(Sprite, Base);

Sprite.prototype.fromJSON = function(data) {

  Sprite.parent.prototype.fromJSON.call(this, data);

  this.direction = data.direction;
  this.indexInLibrary = data.indexInLibrary;
  this.isDraggable = data.isDraggable;
  this.rotationStyle = data.rotationStyle;
  this.scale = data.scale;
  this.scratchX = data.scratchX;
  this.scratchY = data.scratchY;
  this.spriteInfo = data.spriteInfo;
  this.visible = data.visible;

  return this;
};

Sprite.prototype.clone = function() {
  var c = new Sprite(this.stage);

  c.isClone = true;
  c.costumes = this.costumes;
  c.currentCostumeIndex = this.currentCostumeIndex;
  c.objName = this.objName;
  c.soundRefs = this.soundRefs;
  c.sounds = this.sounds;

  var keys = Object.keys(this.vars);
  for (var i = keys.length; i--;) {
    var k = keys[i];
    c.vars[k] = this.vars[k];
  }

  var keys = Object.keys(this.lists);
  for (var i = keys.length; i--;) {
    var k = keys[i];
    c.lists[k] = this.lists[k].slice(0);
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
  c.penColor = this.penColor;
  c.penCSS = this.penCSS;
  c.penHue = this.penHue;
  c.penSaturation = this.penSaturation;
  c.penLightness = this.penLightness;
  c.penSize = this.penSize;
  c.isPenDown = this.isPenDown;

  return c;
};

Sprite.prototype.mouseDown = function() {
  this.dragStartX = this.scratchX;
  this.dragStartY = this.scratchY;
  this.dragOffsetX = this.scratchX - this.stage.mouseX;
  this.dragOffsetY = this.scratchY - this.stage.mouseY;
  this.isDragging = true;
};

Sprite.prototype.mouseUp = function() {
  if (this.isDragging && this.scratchX === this.dragStartX && this.scratchY === this.dragStartY) {
    this.stage.triggerFor(this, 'whenClicked');
  }
  this.isDragging = false;
};

Sprite.prototype.forward = function(steps) {
  var d = (90 - this.direction) * Math.PI / 180;
  this.moveTo(this.scratchX + steps * Math.cos(d), this.scratchY + steps * Math.sin(d));
};

Sprite.prototype.moveTo = function(x, y) {
  var ox = this.scratchX;
  var oy = this.scratchY;
  if (ox === x && oy === y && !this.isPenDown) return;
  this.scratchX = x;
  this.scratchY = y;
  if (this.isPenDown && !this.isDragging) {
    var context = this.stage.penContext;
    if (this.penSize % 2 > .5 && this.penSize % 2 < 1.5) {
      ox -= .5;
      oy -= .5;
      x -= .5;
      y -= .5;
    }
    context.strokeStyle = this.penCSS || 'hsl(' + this.penHue + ',' + this.penSaturation + '%,' + (this.penLightness > 100 ? 200 - this.penLightness : this.penLightness) + '%)';
    context.lineWidth = this.penSize;
    context.beginPath();
    context.moveTo(240 + ox, 180 - oy);
    context.lineTo(240 + x, 180 - y);
    context.stroke();
  }
  if (this.saying) {
    this.updateBubble();
  }
};

Sprite.prototype.dotPen = function() {
  var context = this.stage.penContext;
  var x = this.scratchX;
  var y = this.scratchY;
  context.fillStyle = this.penCSS || 'hsl(' + this.penHue + ',' + this.penSaturation + '%,' + (this.penLightness > 100 ? 200 - this.penLightness : this.penLightness) + '%)';
  context.beginPath();
  context.arc(240 + x, 180 - y, this.penSize / 2, 0, 2 * Math.PI, false);
  context.fill();
};

Sprite.prototype.draw = function(context, noEffects) {
  var costume = this.costumes[this.currentCostumeIndex];

  if (this.isDragging) {
    this.moveTo(this.dragOffsetX + this.stage.mouseX, this.dragOffsetY + this.stage.mouseY);
  }

  if (costume) {
    context.save();

    var z = this.stage.zoom * SCALE;
    context.translate(((this.scratchX + 240) * z | 0) / z, ((180 - this.scratchY) * z | 0) / z);
    if (this.rotationStyle === 'normal') {
      context.rotate((this.direction - 90) * Math.PI / 180);
    } else if (this.rotationStyle === 'leftRight' && this.direction < 0) {
      context.scale(-1, 1);
    }
    context.scale(this.scale, this.scale);
    context.scale(costume.scale, costume.scale);
    context.translate(-costume.rotationCenterX, -costume.rotationCenterY);

    if (!noEffects) context.globalAlpha = Math.max(0, Math.min(1, 1 - this.filters.ghost / 100));

    context.drawImage(costume.image, 0, 0);

    context.restore();
  }
};

Sprite.prototype.setDirection = function(degrees) {
  var d = degrees % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  this.direction = d;
  if (this.saying) this.updateBubble();
};

var collisionCanvas = document.createElement('canvas');
var collisionContext = collisionCanvas.getContext('2d');

Sprite.prototype.touching = function(thing) {
  var costume = this.costumes[this.currentCostumeIndex];

  if (thing === '_mouse_') {
    var bounds = this.rotatedBounds();
    var x = this.stage.rawMouseX;
    var y = this.stage.rawMouseY;
    if (x < bounds.left || y < bounds.bottom || x > bounds.right || y > bounds.top) {
      return false;
    }
    var cx = (x - this.scratchX) / this.scale
    var cy = (this.scratchY - y) / this.scale
    if (this.rotationStyle === 'normal' && this.direction !== 90) {
      var d = (90 - this.direction) * Math.PI / 180
      var ox = cx
      var s = Math.sin(d), c = Math.cos(d)
      cx = c * ox - s * cy
      cy = s * ox + c * cy
    } else if (this.rotationStyle === 'leftRight' && this.direction < 0) {
      cx = -cx
    }
    var d = costume.context.getImageData(cx * costume.bitmapResolution + costume.rotationCenterX, cy * costume.bitmapResolution + costume.rotationCenterY, 1, 1).data;
    return d[3] !== 0;
  } else if (thing === '_edge_') {
    var bounds = this.rotatedBounds();
    return bounds.left <= -240 || bounds.right >= 240 || bounds.top >= 180 || bounds.bottom <= -180;
  } else {
    if (!this.visible) return false;
    var sprites = this.stage.getObjects(thing);
    for (var i = sprites.length; i--;) {
      var sprite = sprites[i];
      if (!sprite.visible) continue;

      var mb = this.rotatedBounds();
      var ob = sprite.rotatedBounds();

      if (mb.bottom >= ob.top || ob.bottom >= mb.top || mb.left >= ob.right || ob.left >= mb.right) {
        continue;
      }

      var left = Math.max(mb.left, ob.left);
      var top = Math.min(mb.top, ob.top);
      var right = Math.min(mb.right, ob.right);
      var bottom = Math.max(mb.bottom, ob.bottom);

      collisionCanvas.width = right - left;
      collisionCanvas.height = top - bottom;

      collisionContext.save();
      collisionContext.translate(-(left + 240), -(180 - top));

      this.draw(collisionContext, true);
      collisionContext.globalCompositeOperation = 'source-in';
      sprite.draw(collisionContext, true);

      collisionContext.restore();

      var data = collisionContext.getImageData(0, 0, right - left, top - bottom).data;

      var length = (right - left) * (top - bottom) * 4;
      for (var j = 0; j < length; j += 4) {
        if (data[j + 3]) {
          return true;
        }
      }
    }
    return false;
  }
};

Sprite.prototype.touchingColor = function(rgb) {
  var b = this.rotatedBounds();
  collisionCanvas.width = b.right - b.left;
  collisionCanvas.height = b.top - b.bottom;

  collisionContext.save();
  collisionContext.translate(-(240 + b.left), -(180 - b.top));

  this.stage.drawAllOn(collisionContext, this);
  collisionContext.globalCompositeOperation = 'destination-in';
  this.draw(collisionContext, true);

  collisionContext.restore();

  var data = collisionContext.getImageData(0, 0, b.right - b.left, b.top - b.bottom).data;

  rgb = rgb & 0xffffff;
  var length = (b.right - b.left) * (b.top - b.bottom) * 4;
  for (var i = 0; i < length; i += 4) {
    if ((data[i] << 16 | data[i + 1] << 8 | data[i + 2]) === rgb && data[i + 3]) {
      return true;
    }
  }

  return false;
};

Sprite.prototype.bounceOffEdge = function() {
  var b = this.rotatedBounds();
  var dl = 240 + b.left;
  var dt = 180 - b.top;
  var dr = 240 - b.right;
  var db = 180 + b.bottom;

  var d = Math.min(dl, dt, dr, db);
  if (d > 0) return;

  var dir = this.direction * Math.PI / 180;
  var dx = Math.sin(dir);
  var dy = -Math.cos(dir);

  switch (d) {
    case dl: dx = Math.max(0.2, Math.abs(dx)); break;
    case dt: dy = Math.max(0.2, Math.abs(dy)); break;
    case dr: dx = -Math.max(0.2, Math.abs(dx)); break;
    case db: dy = -Math.max(0.2, Math.abs(dy)); break;
  }

  this.direction = Math.atan2(dy, dx) * 180 / Math.PI + 90;
  if (this.saying) this.updateBubble();

  b = this.rotatedBounds();
  var x = this.scratchX;
  var y = this.scratchY;
  if (b.left < -240) x += -240 - b.left;
  if (b.top > 180) y += 180 - b.top;
  if (b.right > 240) x += 240 - b.left;
  if (b.bottom < -180) y += -180 - b.top;
};

Sprite.prototype.rotatedBounds = function() {
  var costume = this.costumes[this.currentCostumeIndex];

  var s = costume.scale * this.scale;
  var left = -costume.rotationCenterX * s;
  var top = costume.rotationCenterY * s;
  var right = left + costume.image.width * s;
  var bottom = top - costume.image.height * s;

  if (this.rotationStyle !== 'normal') {
    if (this.rotationStyle === 'leftRight' && this.direction < 0) {
      right = -left;
      left = right - costume.image.width * costume.scale * this.scale;
    }
    return {
      left: this.scratchX + left,
      right: this.scratchX + right,
      top: this.scratchY + top,
      bottom: this.scratchY + bottom
    };
  }

  var mSin = Math.sin(this.direction * Math.PI / 180);
  var mCos = Math.cos(this.direction * Math.PI / 180);

  var tlX = mSin * left - mCos * top;
  var tlY = mCos * left + mSin * top;

  var trX = mSin * right - mCos * top;
  var trY = mCos * right + mSin * top;

  var blX = mSin * left - mCos * bottom;
  var blY = mCos * left + mSin * bottom;

  var brX = mSin * right - mCos * bottom;
  var brY = mCos * right + mSin * bottom;

  return {
    left: this.scratchX + Math.min(tlX, trX, blX, brX),
    right: this.scratchX + Math.max(tlX, trX, blX, brX),
    top: this.scratchY + Math.max(tlY, trY, blY, brY),
    bottom: this.scratchY + Math.min(tlY, trY, blY, brY)
  };
};

Sprite.prototype.showRotatedBounds = function() {
  var bounds = this.rotatedBounds();
  var div = document.createElement('div');
  div.style.outline = '1px solid red';
  div.style.position = 'absolute';
  div.style.left = (240 + bounds.left) + 'px';
  div.style.top = (180 - bounds.top) + 'px';
  div.style.width = (bounds.right - bounds.left) + 'px';
  div.style.height = (bounds.top - bounds.bottom) + 'px';
  this.stage.canvas.parentNode.appendChild(div);
};

Sprite.prototype.distanceTo = function(thing) {
  if (thing === '_mouse_') {
    var x = this.stage.mouseX;
    var y = this.stage.mouseY;
  } else {
    var sprite = this.stage.getObject(thing);
    if (!sprite) return 10000;
    x = sprite.scratchX;
    y = sprite.scratchY;
  }
  return Math.sqrt((this.scratchX - x) * (this.scratchX - x) + (this.scratchY - y) * (this.scratchY - y));
};

Sprite.prototype.gotoObject = function(thing) {
  if (thing === '_mouse_') {
    this.moveTo(this.stage.mouseX, this.stage.mouseY);
  } else if (thing === '_random_') {
    var x = Math.round(480 * Math.random() - 240);
    var y = Math.round(360 * Math.random() - 180);
    this.moveTo(x, y);
  } else {
    var sprite = this.stage.getObject(thing);
    if (!sprite) return 0;
    this.moveTo(sprite.scratchX, sprite.scratchY);
  }
};

Sprite.prototype.pointTowards = function(thing) {
  if (thing === '_mouse_') {
    var x = this.stage.mouseX;
    var y = this.stage.mouseY;
  } else {
    var sprite = this.stage.getObject(thing);
    if (!sprite) return 0;
    x = sprite.scratchX;
    y = sprite.scratchY;
  }
  var dx = x - this.scratchX;
  var dy = y - this.scratchY;
  this.direction = dx === 0 && dy === 0 ? 90 : Math.atan2(dx, dy) * 180 / Math.PI;
  if (this.saying) this.updateBubble();
};

Sprite.prototype.say = function(text, thinking) {
  text = '' + text;
  if (!text) {
    this.saying = false;
    if (!this.bubble) return;
    this.bubble.style.display = 'none';
    return ++this.sayId;
  }
  this.saying = true;
  this.thinking = thinking;
  if (!this.bubble) {
    this.bubble = document.createElement('div');
    this.bubble.style.maxWidth = ''+(127/14)+'em';
    this.bubble.style.minWidth = ''+(48/14)+'em';
    this.bubble.style.padding = ''+(8/14)+'em '+(10/14)+'em';
    this.bubble.style.border = ''+(3/14)+'em solid rgb(160, 160, 160)';
    this.bubble.style.borderRadius = ''+(10/14)+'em';
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
    this.bubblePointer.style.height = ''+(21/14)+'em';
    this.bubblePointer.style.width = ''+(44/14)+'em';
    this.bubblePointer.style.background = 'url(icons.svg) '+(-195/14)+'em '+(-4/14)+'em';
    this.bubblePointer.style.backgroundSize = ''+(320/14)+'em '+(96/14)+'em';
    this.stage.ui.appendChild(this.bubble);
  }
  this.bubblePointer.style.backgroundPositionX = ((thinking ? -259 : -195)/14)+'em';
  this.bubble.style.display = 'block';
  this.bubbleText.nodeValue = text;
  this.updateBubble();
  return ++this.sayId;
};

Sprite.prototype.updateBubble = function() {
  if (!this.visible || !this.saying) {
    this.bubble.style.display = 'none';
    return;
  }
  var b = this.rotatedBounds();
  var left = 240 + b.right;
  var bottom = 180 + b.top;
  var width = this.bubble.offsetWidth / this.stage.zoom;
  var height = this.bubble.offsetHeight / this.stage.zoom;
  this.bubblePointer.style.top = ((height - 6) / 14) + 'em';
  if (left + width + 2 > 480) {
    this.bubble.style.right = ((240 - b.left) / 14) + 'em';
    this.bubble.style.left = 'auto';
    this.bubblePointer.style.right = (3/14)+'em';
    this.bubblePointer.style.left = 'auto';
    this.bubblePointer.style.backgroundPositionY = (-36/14)+'em';
  } else {
    this.bubble.style.left = (left / 14) + 'em';
    this.bubble.style.right = 'auto';
    this.bubblePointer.style.left = (3/14)+'em';
    this.bubblePointer.style.right = 'auto';
    this.bubblePointer.style.backgroundPositionY = (-4/14)+'em';
  }
  if (bottom + height + 2 > 360) {
    bottom = 360 - height - 2;
  }
  if (bottom < 19) {
    bottom = 19;
  }
  this.bubble.style.bottom = (bottom / 14) + 'em';
};

Sprite.prototype.remove = function() {
  if (this.bubble) {
    this.stage.ui.removeChild(this.bubble);
    this.bubble = null;
  }
  if (this.node) {
    this.node.disconnect();
    this.node = null;
  }
};

module.exports = Sprite;