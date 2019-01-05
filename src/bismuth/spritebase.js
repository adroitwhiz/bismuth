const Costume = require("./costume");
const Sound = require("./sound");

var Base = function() {
	this.isClone = false;
	this.costumes = [];
	this.currentCostumeIndex = 0;
	this.objName = '';
	this.instrument = 0;
	this.volume = 1;

	this.soundRefs = Object.create(null);
	this.sounds = [];

	this.vars = Object.create(null);
	this.watchers = Object.create(null);
	this.lists = Object.create(null);

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
	for (var i = 0; i < 128; i++) {
		this.listeners.whenKeyPressed.push([]);
	}
	this.fns = [];
	this.scripts = [];

	this.filters = {
		color: 0,
		fisheye: 0,
		whirl: 0,
		pixelate: 0,
		mosaic: 0,
		brightness: 0,
		ghost: 0
	};
};

Base.prototype.fromJSON = function(data) {
	this.objName = data.objName;
	this.scripts = data.scripts;
	this.currentCostumeIndex = data.currentCostumeIndex || 0;
	this.costumes = data.costumes.map(function(d, i) {
		return new Costume(d, i, this);
	}, this);
	this.addSounds(data.sounds);
	this.addLists(data.lists);
	this.addVariables(data.variables);

	return this;
};

Base.prototype.addSounds = function(sounds) {
	for (var i = 0; i < sounds.length; i++) {
		var s = new Sound(sounds[i]);
		this.sounds.push(s);
		this.soundRefs[s.name] = s;
	}
};

Base.prototype.addVariables = function(variables) {
	for (var i = 0; i < variables.length; i++) {
		if (variables[i].isPeristent) {
			throw new Error('Cloud variables are not supported');
		}
		this.vars[variables[i].name] = variables[i].value;
	}
};

Base.prototype.addLists = function(lists) {
	for (var i = 0; i < lists.length; i++) {
		if (lists[i].isPeristent) {
			throw new Error('Cloud lists are not supported');
		}
		this.lists[lists[i].listName] = lists[i].contents;
		// TODO list watchers
	}
};

Base.prototype.showVariable = function(name, visible) {
	var watcher = this.watchers[name];
	var stage = this.stage;
	if (!watcher) {
		watcher = this.watchers[name] = new P.Watcher(stage);
		watcher.x = stage.defaultWatcherX;
		watcher.y = stage.defaultWatcherY;
		stage.defaultWatcherY += 26;
		if (stage.defaultWatcherY >= 450) {
			stage.defaultWatcherY = 10;
			stage.defaultWatcherX += 150;
		}
		watcher.target = this;
		watcher.label = (watcher.target === stage ? '' : watcher.target.objName + ': ') + name;
		watcher.param = name;
		stage.allWatchers.push(watcher);
	}
	watcher.visible = visible;
	watcher.layout();
};

Base.prototype.showNextCostume = function() {
	this.currentCostumeIndex = (this.currentCostumeIndex + 1) % this.costumes.length;
	if (this.isStage) this.updateBackdrop();
	if (this.saying) this.updateBubble();
};

Base.prototype.showPreviousCostume = function() {
	var length = this.costumes.length;
	this.currentCostumeIndex = (this.currentCostumeIndex + length - 1) % length;
	if (this.isStage) this.updateBackdrop();
	if (this.saying) this.updateBubble();
};

Base.prototype.getCostumeName = function() {
	return this.costumes[this.currentCostumeIndex] ? this.costumes[this.currentCostumeIndex].costumeName : '';
};

Base.prototype.setCostume = function(costume) {
	if (typeof costume !== 'number') {
		costume = '' + costume;
		for (var i = 0; i < this.costumes.length; i++) {
			if (this.costumes[i].costumeName === costume) {
				this.currentCostumeIndex = i;
				if (this.isStage) this.updateBackdrop();
				if (this.saying) this.updateBubble();
				return;
			}
		}
		if (costume === (this.isSprite ? 'next costume' : 'next backdrop')) {
			this.showNextCostume();
			return;
		}
		if (costume === (this.isSprite ? 'previous costume' : 'previous backdrop')) {
			this.showPreviousCostume();
			return;
		}
	}
	var i = (Math.floor(costume) - 1 || 0) % this.costumes.length;
	if (i < 0) i += this.costumes.length;
	this.currentCostumeIndex = i;
	if (this.isStage) this.updateBackdrop();
	if (this.saying) this.updateBubble();
};

Base.prototype.setFilter = function(name, value) {
	switch (name) {
		case 'ghost':
			if (value < 0) value = 0;
			if (value > 100) value = 100;
			break;
		case 'brightness':
			if (value < -100) value = -100;
			if (value > 100) value = 100;
			break;
		case 'color':
			value = value % 200;
			if (value < 0) value += 200;
			break;
	}
	this.filters[name] = value;
	if (this.isStage) this.updateFilters();
};

Base.prototype.changeFilter = function(name, value) {
	this.setFilter(name, this.filters[name] + value);
};

Base.prototype.resetFilters = function() {
	this.filters = {
		color: 0,
		fisheye: 0,
		whirl: 0,
		pixelate: 0,
		mosaic: 0,
		brightness: 0,
		ghost: 0
	};
};

Base.prototype.getSound = function(name) {
	if (typeof name === 'string') {
		var s = this.soundRefs[name];
		if (s) return s;
		name = +name;
	}
	var l = this.sounds.length;
	if (l && typeof name === 'number' && name === name) {
		var i = Math.round(name - 1) % l;
		if (i < 0) i += l;
		return this.sounds[i];
	}
};

Base.prototype.stopSounds = function() {
	if (this.node) {
		this.node.disconnect();
		this.node = null;
	}
	for (var i = this.sounds.length; i--;) {
		var s = this.sounds[i];
		if (s.node) {
			s.node.disconnect();
			s.node = null;
		}
	}
};

Base.prototype.ask = function(question) {
	var stage = this.stage;
	if (question) {
		if (this.isSprite && this.visible) {
			this.say(question);
			stage.promptTitle.style.display = 'none';
		} else {
			stage.promptTitle.style.display = 'block';
			stage.promptTitle.textContent = question;
		}
	} else {
		stage.promptTitle.style.display = 'none';
	}
	stage.hidePrompt = false;
	stage.prompter.style.display = 'block';
	stage.prompt.value = '';
	stage.prompt.focus();
};

module.exports = Base;