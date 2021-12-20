class Request {
	constructor () {
		this.loaded = 0;
		this.isDone = false;
		this.listeners = {
			load: [],
			progress: [],
			error: []
		};
	}

	on (event, callback) {
		if (this.listeners.hasOwnProperty(event)) {
			const listeners = this.listeners[event];

			listeners.push(callback);
		} else {
			console.warn(`Unknown event '${event}'`);
		}

		return this;
	}

	dispatchEvent (event, result) {
		if (this.listeners.hasOwnProperty(event)) {
			for (const listener of this.listeners[event]) {
				listener(result);
			}
		} else {
			console.warn(`Unknown event '${event}'`);
		}

		return this;
	}

	load (result) {
		// Delay for one microtick to prevent synchronous shenanigans
		Promise.resolve().then(() => {
			this.result = result;
			this.isDone = true;
			this.dispatchEvent('load', result);
		});
	}

	progress (loaded, total, lengthComputable) {
		this.loaded = loaded;
		this.total = total;
		this.lengthComputable = lengthComputable;
		this.dispatchEvent('progress', {
			loaded: loaded,
			total: total,
			lengthComputable: lengthComputable
		});
	}

	error (error) {
		// Delay for one microtick to prevent synchronous shenanigans
		Promise.resolve().then(() => {
			this.result = error;
			this.isError = true;
			this.isDone = true;
			this.dispatchEvent('error', error);
		});
	}
}

module.exports = Request;
