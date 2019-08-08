const addEvents = function (cla /*, events... */) {
	[].slice.call(arguments, 1).forEach(function (event) {
		addEvent(cla, event);
	});
};

const addEvent = function (cla, event) {
	const capital = event[0].toUpperCase() + event.substr(1);

	cla.prototype.addEventListener = cla.prototype.addEventListener || function (event, listener) {
		const listeners = this['$' + event] = this['$' + event] || [];
		listeners.push(listener);
		return this;
	};

	cla.prototype.removeEventListener = cla.prototype.removeEventListener || function (event, listener) {
		const listeners = this['$' + event];
		if (listeners) {
			const i = listeners.indexOf(listener);
			if (i !== -1) {
				listeners.splice(i, 1);
			}
		}
		return this;
	};

	cla.prototype.dispatchEvent = cla.prototype.dispatchEvent || function (event, arg) {
		const listeners = this['$' + event];
		if (listeners) {
			listeners.forEach(function (listener) {
				listener(arg);
			});
		}
		const listener = this['on' + event];
		if (listener) {
			listener(arg);
		}
		return this;
	};

	cla.prototype['on' + capital] = function (listener) {
		this.addEventListener(event, listener);
		return this;
	};

	cla.prototype['dispatch' + capital] = function (arg) {
		this.dispatchEvent(event, arg);
		return this;
	};
};

module.exports = {addEvents, addEvent};
