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

class CompositeRequest extends Request {
	constructor () {
		super();

		this.requests = [];
		this.isDone = false;
		this.update = this.update.bind(this);
		this.error = this.error.bind(this);
	}

	add (request) {
		if (request instanceof CompositeRequest) {
			for (let i = 0; i < request.requests.length; i++) {
				this.add(request.requests[i]);
			}
		} else {
			this.requests.push(request);
			request.on('progress', this.update);
			request.on('load', this.update);
			request.on('error', this.error);
			this.update();
		}
	}

	update () {
		if (this.isError) return;
		const requests = this.requests;
		let i = requests.length;
		let total = 0;
		let loaded = 0;
		let lengthComputable = true;
		let uncomputable = 0;
		let done = 0;
		let currentRequest;
		while (i--) {
			currentRequest = requests[i];
			loaded += currentRequest.loaded;
			if (currentRequest.isDone) {
				total += currentRequest.loaded;
				done += 1;
			} else if (currentRequest.lengthComputable) {
				total += currentRequest.total;
			} else {
				lengthComputable = false;
				uncomputable += 1;
			}
		}
		if (!lengthComputable && uncomputable !== requests.length) {
			const each = total / (requests.length - uncomputable) * uncomputable;
			i = requests.length;
			total = 0;
			loaded = 0;
			lengthComputable = true;
			while (i--) {
				currentRequest = requests[i];
				if (currentRequest.lengthComputable) {
					loaded += currentRequest.loaded;
					total += currentRequest.total;
				} else {
					total += each;
					if (currentRequest.isDone) loaded += each;
				}
			}
		}
		this.progress(loaded, total, lengthComputable);
		this.doneCount = done;
		this.isDone = done === requests.length;
		if (this.isDone && !this.defer) {
			this.load(this.getResult());
		}
	}

	getResult () {
		throw new Error('Users must implement getResult()');
	}
}

module.exports = {Request, CompositeRequest};
