const timeAndDate = require('./util/time-and-date');

class Watcher {
	constructor (stage) {
		this.stage = stage;

		this.opcode = 'data_variable';
		this.isDiscrete = true;
		this.label = 'watcher';
		this.mode = 'default';
		this.params = {};
		this.sliderMax = 100;
		this.sliderMin = 0;
		this.target = undefined;
		this.targetName = null;
		this.visible = true;
		this.x = 0;
		this.y = 0;

		this.el = null;
		this.labelEl = null;
		this.readout = null;
		this.slider = null;
		this.button = null;
	}

	resolve () {
		this.color = getWatcherColor(this.opcode);
		// Scratch 3.0 uses null targetName for things that belong to the stage
		this.target = this.targetName === null ? this.stage : this.stage.getObject(this.targetName);
		if (this.target && this.opcode === 'data_variable') {
			this.target.watchers[this.params.VARIABLE] = this;
		}
		if (!this.label) {
			this.label = this.getLabel();
			if (this.target && this.target.isSprite) this.label = `${this.target.objName}: ${this.label}`;
		}
		this.layout();
	}

	getLabel () {
		switch (this.opcode) {
			case 'data_variable': return this.params.VARIABLE;
			case 'sensing_current': return getDateLabel(this.params.CURRENTMENU);
			case 'looks_costumenumbername': return 'costume ' + this.params.NUMBER_NAME;
			case 'looks_backdropnumbername': return 'backdrop ' + this.params.NUMBER_NAME;
		}
		return WATCHER_LABELS[this.opcode] || '';
	}

	update () {
		let value = 0;
		if (!this.target) return;
		switch (this.opcode) {
			case 'sensing_answer':
				value = this.stage.answer;
				break;
			case 'looks_backdropnumbername':
				if (this.params.NUMBER_NAME === 'number') {
					value = this.stage.currentCostumeIndex + 1;
				} else {
					value = this.stage.costumes[this.stage.currentCostumeIndex].costumeName;
				}
				break;
			case 'looks_costumenumbername':
				if (this.params.NUMBER_NAME === 'number') {
					value = this.target.currentCostumeIndex + 1;
				} else {
					value = this.target.costumes[this.stage.currentCostumeIndex].costumeName;
				}
				break;
			case 'data_variable':
				value = this.target.vars[this.params.VARIABLE];
				break;
			case 'motion_direction':
				value = this.target.direction;
				break;
			case 'looks_size':
				value = this.target.size;
				break;
			case 'sensing_loudness':
			case 'sensing_loud':
				// TODO
				break;
			case 'sensing_username':
				// Match the runtime's behavior (empty string)
				value = '';
				break;
			case 'music_getTempo':
				value = this.stage.tempoBPM;
				break;
			case 'sensing_current':
				value = timeAndDate(this.params.CURRENTMENU.toLowerCase());
				break;
			case 'sensing_timer':
				value = Math.round((this.stage.rightNow() - this.stage.timerStart) / 100) / 10;
				break;
			case 'sound_volume':
				value = this.target.volume;
				break;
			case 'motion_xposition':
				value = this.target.scratchX;
				break;
			case 'motion_yposition':
				value = this.target.scratchY;
				break;
		}
		if (typeof value === 'number' && (value < 0.001 || value > 0.001)) {
			value = Math.round(value * 1000) / 1000;
		}
		this.readout.textContent = String(value);
		if (this.slider) {
			this.buttonWrap.style.transform = `translate(${((+value || 0) - this.sliderMin) / (this.sliderMax - this.sliderMin) * 100}%,0)`;
		}
	}

	layout () {
		if (this.el) {
			this.el.style.display = this.visible ? 'block' : 'none';
			return;
		}
		if (!this.visible) return;

		this.el = document.createElement('div');
		this.el.dataset.watcher = this.stage.allWatchers.indexOf(this);
		this.el.style.whiteSpace = 'pre';
		this.el.style.position = 'absolute';
		this.el.style.left = this.el.style.top = '0';
		this.el.style.transform = `translate(${(this.x | 0) / 10}em,${(this.y | 0) / 10}em)`;
		this.el.style.cursor = 'default';
		this.el.style.pointerEvents = 'auto';

		if (this.mode === 'large') {
			this.el.appendChild(this.readout = document.createElement('div'));
			this.readout.style.minWidth = `${38 / 15}em`;
			this.readout.style.font = `bold 1.5em/${19 / 15} sans-serif`;
			this.readout.style.height = `${19 / 15}em`;
			this.readout.style.borderRadius = `${4 / 15}em`;
			this.readout.style.margin = `${3 / 15}em 0 0 0`;
			this.readout.style.padding = `0 ${3 / 10}em`;
		} else {
			this.el.appendChild(this.labelEl = document.createElement('div'), this.el.firstChild);
			this.el.appendChild(this.readout = document.createElement('div'));

			this.el.style.border = '.1em solid rgb(148,145,145)';
			this.el.style.borderRadius = '.4em';
			this.el.style.background = 'rgb(193,196,199)';
			this.el.style.padding = '.2em .6em .3em .5em';

			this.labelEl.textContent = this.label;
			// this.labelEl.style.marginTop = (1/11)+'em';
			this.labelEl.style.font = 'bold 1.1em/1 sans-serif';
			this.labelEl.style.display = 'inline-block';

			this.labelEl.style.verticalAlign =
			this.readout.style.verticalAlign = 'middle';

			this.readout.style.minWidth = `${37 / 10}em`;
			this.readout.style.padding = `0 ${1 / 10}em`;
			this.readout.style.font = `bold 1.0em/${13 / 10} sans-serif`;
			this.readout.style.height = `${13 / 10}em`;
			this.readout.style.borderRadius = `${4 / 10}em`;
			this.readout.style.marginLeft = `${6 / 10}em`;
		}
		this.readout.style.color = '#fff';
		const f = 1 / (this.mode === 'large' ? 15 : 10);
		this.readout.style.border = `${f}em solid #fff`;
		this.readout.style.boxShadow = `inset ${f}em ${f}em ${f}em rgba(0,0,0,.5), inset -${f}em -${f}em ${f}em rgba(255,255,255,.5)`;
		this.readout.style.textAlign = 'center';
		this.readout.style.background = this.color;
		this.readout.style.display = 'inline-block';

		if (this.mode === 'slider') {
			this.el.appendChild(this.slider = document.createElement('div'));
			this.slider.appendChild(this.buttonWrap = document.createElement('div'));
			this.buttonWrap.appendChild(this.button = document.createElement('div'));

			this.slider.style.height =
			this.slider.style.borderRadius = '.5em';
			this.slider.style.background = 'rgb(192,192,192)';
			this.slider.style.margin = '.4em 0 .1em';
			this.slider.style.boxShadow = 'inset .125em .125em .125em rgba(0,0,0,.5), inset -.125em -.125em .125em rgba(255,255,255,.5)';
			this.slider.style.position = 'relative';
			this.slider.dataset.slider = '';

			this.slider.style.paddingRight =
			this.button.style.width =
			this.button.style.height =
			this.button.style.borderRadius = '1.1em';
			this.button.style.position = 'absolute';
			this.button.style.left = '0';
			this.button.style.top = '-.3em';
			this.button.style.background = '#fff';
			this.button.style.boxShadow = 'inset .3em .3em .2em -.2em rgba(255,255,255,.9), inset -.3em -.3em .2em -.2em rgba(0,0,0,.9), inset 0 0 0 .1em #777';
			this.button.dataset.button = '';
		}

		this.stage.ui.appendChild(this.el);
	}
}

const getDateLabel = dateParam => {
	if (dateParam === 'DAYOFWEEK') return 'day of week';
	return dateParam.toLowerCase();
};

const getWatcherColor = opcode => {
	if (opcode.startsWith('motion_')) return '#4a6cd4';
	if (opcode.startsWith('looks_')) return '#8a55d7';
	if (opcode.startsWith('sound_') || opcode.startsWith('music_')) return '#bb42c3';
	if (opcode.startsWith('events_')) return '#c88330';
	if (opcode.startsWith('control_')) return '#e1a91a';
	if (opcode.startsWith('sensing_')) return '#2ca5e2';
	if (opcode.startsWith('operator_')) return '#5cb712';
	if (opcode.startsWith('data_')) return '#ee7d16';
};

const WATCHER_LABELS = {
	'motion_xposition': 'x position',
	'motion_yposition': 'y position',
	'motion_direction': 'direction',
	'looks_size': 'size',
	'music_getTempo': 'tempo',
	'sound_volume': 'volume',
	'sensing_answer': 'answer',
	'sensing_timer': 'timer',
	'sensing_loudness': 'loudness',
	'sensing_loud': 'loud?',
	'sensing_username': 'username',
	'motion_xscroll': 'x scroll',
	'motion_yscroll': 'y scroll'
};

module.exports = Watcher;
