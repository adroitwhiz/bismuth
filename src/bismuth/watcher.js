class Watcher {
	constructor (stage) {
		this.stage = stage;

		this.cmd = 'getVar:';
		this.color = '#ee7d16';
		this.isDiscrete = true;
		this.label = 'watcher';
		this.mode = 1;
		this.param = 'var';
		this.sliderMax = 100;
		this.sliderMin = 0;
		this.target = undefined;
		this.visible = true;
		this.x = 0;
		this.y = 0;

		this.el = null;
		this.labelEl = null;
		this.readout = null;
		this.slider = null;
		this.button = null;
	}

	fromJSON (data) {
		this.cmd = data.cmd || 'getVar:';
		if (data.color) {
			const c = (data.color < 0 ? data.color + 0x1000000 : data.color).toString(16);
			this.color = '#000000'.slice(0, -c.length) + c;
		}
		this.isDiscrete = data.isDiscrete == null ? true : data.isDiscrete;
		this.label = data.label || '';
		this.mode = data.mode || 1;
		this.param = data.param;
		this.sliderMax = data.sliderMax == null ? 100 : data.sliderMax;
		this.sliderMin = data.sliderMin || 0;
		this.targetName = data.target;
		this.visible = data.visible == null ? true : data.visible;
		this.x = data.x || 0;
		this.y = data.y || 0;

		return this;
	}

	resolve () {
		this.target = this.stage.getObject(this.targetName);
		if (this.target && this.cmd === 'getVar:') {
			this.target.watchers[this.param] = this;
		}
		if (!this.label) {
			this.label = this.getLabel();
			if (this.target.isSprite) this.label = `${this.target.objName}: ${this.label}`;
		}
		this.layout();
	}

	getLabel () {
		switch (this.cmd) {
			case 'getVar:': return this.param;
			case 'sensor:': return `${this.param} sensor value`;
			case 'sensorPressed': return `sensor ${this.param}?`;
			case 'timeAndDate': return this.param;
			case 'senseVideoMotion': return `video ${this.param}`;
		}
		return WATCHER_LABELS[this.cmd] || '';
	}

	update (context) {
		let value = 0;
		if (!this.target) return;
		switch (this.cmd) {
			case 'answer':
				value = this.stage.answer;
				break;
			case 'backgroundIndex':
				value = this.stage.currentCostumeIndex + 1;
				break;
			case 'costumeIndex':
				value = this.target.currentCostumeIndex + 1;
				break;
			case 'getVar:':
				value = this.target.vars[this.param];
				break;
			case 'heading':
				value = this.target.direction;
				break;
			case 'scale':
				value = this.target.scale * 100;
				break;
			case 'sceneName':
				value = this.stage.getCostumeName();
				break;
			case 'senseVideoMotion':
				// TODO
				break;
			case 'soundLevel':
				// TODO
				break;
			case 'tempo':
				value = this.stage.tempoBPM;
				break;
			case 'timeAndDate':
				value = this.timeAndDate(this.param);
				break;
			case 'timer':
				value = Math.round((this.stage.rightNow() - this.stage.timerStart) / 100) / 10;
				break;
			case 'volume':
				value = this.target.volume * 100;
				break;
			case 'xpos':
				value = this.target.scratchX;
				break;
			case 'ypos':
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

		if (this.mode === 2) {
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
		const f = 1 / (this.mode === 2 ? 15 : 10);
		this.readout.style.border = `${f}em solid #fff`;
		this.readout.style.boxShadow = `inset ${f}em ${f}em ${f}em rgba(0,0,0,.5), inset -${f}em -${f}em ${f}em rgba(255,255,255,.5)`;
		this.readout.style.textAlign = 'center';
		this.readout.style.background = this.color;
		this.readout.style.display = 'inline-block';

		if (this.mode === 3) {
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

	timeAndDate (format) {
		switch (format) {
			case 'year':
				return new Date().getFullYear();
			case 'month':
				return new Date().getMonth() + 1;
			case 'date':
				return new Date().getDate();
			case 'day of week':
				return new Date().getDay() + 1;
			case 'hour':
				return new Date().getHours();
			case 'minute':
				return new Date().getMinutes();
			case 'second':
				return new Date().getSeconds();
		}
		return 0;
	}
}

const WATCHER_LABELS = {
	'costumeIndex': 'costume #',
	'xpos': 'x position',
	'ypos': 'y position',
	'heading': 'direction',
	'scale': 'size',
	'backgroundIndex': 'background #',
	'sceneName': 'background name',
	'tempo': 'tempo',
	'volume': 'volume',
	'answer': 'answer',
	'timer': 'timer',
	'soundLevel': 'loudness',
	'isLoud': 'loud?',
	'xScroll': 'x scroll',
	'yScroll': 'y scroll'
};

module.exports = Watcher;
