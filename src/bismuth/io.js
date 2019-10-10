const canvg = require('canvg');
const JSZip = require('jszip');

const Request = require('./request');
const Stage = require('./stage');

const decodeADPCMAudio = require('./io/decode-adpcm-audio.js');
const fixSVG = require('./io/fix-svg.js');
const instruments = require('./io/instrument-wavs.js');
const parseJSONish = require('./io/parse-jsonish.js');

const IO = {};

IO.PROJECT_URL = 'https://projects.scratch.mit.edu/';
IO.PROJECT_API_URL = 'https://cors-anywhere.herokuapp.com/https://api.scratch.mit.edu/projects/';
IO.ASSET_URL = 'https://assets.scratch.mit.edu/internalapi/asset/';
IO.SOUNDBANK_URL = 'https://cdn.rawgit.com/LLK/scratch-flash/v429/src/soundbank/';

IO.init = request => {
	IO.projectRequest = request;
	IO.zip = null;
};

IO.load = (url, callback, type) => {
	const request = new Request.Request();
	const xhr = new XMLHttpRequest();
	xhr.open('GET', url, true);
	xhr.onprogress = e => {
		request.progress(e.loaded, e.total, e.lengthComputable);
	};
	xhr.onload = () => {
		// console.log(xhr);
		if (xhr.status === 200) {
			request.load(xhr.response);
		} else {
			request.error(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
		}
	};
	xhr.onerror = () => {
		request.error(new Error('XHR Error'));
	};
	xhr.responseType = type || '';
	setTimeout(xhr.send.bind(xhr));

	if (callback) request.on('load', callback);
	return request;
};

IO.loadImage = (url, callback, self) => {
	console.log(`load image ${url}`);
	const request = new Request.Request();
	const image = new Image();
	image.crossOrigin = 'anonymous';
	image.src = url;
	image.onload = () => {
		request.load(image);
	};
	image.onerror = () => {
		request.error(new Error(`Failed to load image: ${url}`));
	};
	if (callback) request.on('load', callback.bind(self));
	return request;
};

IO.loadScratchr2Project = id => {
	const request = new Request.CompositeRequest();
	IO.init(request);

	request.defer = true;
	const projectURL = IO.PROJECT_URL + id;
	request.add(IO.load(projectURL).on('load', contents => {
		try {
			const json = parseJSONish(contents);

			try {
				IO.loadProject(json);
				if (request.isDone) {
					request.load(new Stage().fromJSON(json));
				} else {
					request.defer = false;
					request.getResult = () => new Stage().fromJSON(json);
				}
			} catch (e) {
				request.error(e);
			}
		} catch (e) {
			request.add(IO.load(projectURL, null, 'arraybuffer').on('load', ab => {
				const request2 = new Request.Request();
				request.add(request2);
				request.add(IO.loadSB2Project(ab, stage => {
					request.getResult = () => stage;
					request2.load();
				}));
				request.defer = false;
			}));
			return;
		}
	}));

	return request;
};

IO.loadScratchr2ProjectTitle = (id, callback, self) => {
	const request = new Request.CompositeRequest();

	request.defer = true;
	request.add(P.IO.load(IO.PROJECT_API_URL + id).on('load', data => {
		const m = JSON.parse(data).title;
		if (callback) request.on('load', callback.bind(self));
		if (m) {
			request.load(m);
		} else {
			request.error(new Error('No title'));
		}
	}));

	return request;
};

IO.loadSB2Project = (ab, callback, self) => {
	const request = new Request.CompositeRequest();
	IO.init(request);

	try {
		IO.zip = ab instanceof ArrayBuffer ? new JSZip(ab) : ab;
		const json = parseJSONish(IO.zip.file('project.json').asText());

		IO.loadProject(json);
		if (callback) request.on('load', callback.bind(self));
		if (request.isDone) {
			request.load(new Stage().fromJSON(json));
		} else {
			request.getResult = () => new Stage().fromJSON(json);
		}
	} catch (e) {
		request.error(e);
	}

	return request;
};

IO.loadSB2File = (file, callback, self) => {
	const cr = new Request.CompositeRequest();
	cr.defer = true;
	const request = new Request.Request();
	cr.add(request);
	const reader = new FileReader();
	reader.onloadend = () => {
		cr.defer = true;
		cr.add(IO.loadSB2Project(reader.result, result => {
			cr.defer = false;
			cr.getResult = () => result;
			cr.update();
		}));
		request.load();
	};
	reader.onprogress = e => {
		request.progress(e.loaded, e.total, e.lengthComputable);
	};
	reader.readAsArrayBuffer(file);
	if (callback) cr.on('load', callback.bind(self));
	return cr;
};

IO.loadProject = data => {
	IO.loadInstruments();
	IO.loadArray(data.children, IO.loadObject);
	IO.loadBase(data);
};

IO.instrumentBuffers = Object.create(null);
IO.loadInstruments = () => {
	if (!P.audioContext) return;

	for (const name in instruments) {
		if (IO.instrumentBuffers[name]) {
			if (IO.instrumentBuffers[name] instanceof Request.Request) {
				IO.projectRequest.add(IO.instrumentBuffers[name]);
			}
		} else {
			IO.projectRequest.add(IO.instrumentBuffers[name] = IO.loadInstrumentBuffer(name));
		}
	}
};

IO.loadInstrumentBuffer = name => {
	const request = new Request.Request();
	IO.load(IO.SOUNDBANK_URL + instruments[name], ab => {
		IO.decodeAudio(ab, buffer => {
			IO.instrumentBuffers[name] = buffer;
			request.load();
		});
	}, 'arraybuffer').on('error', err => {
		request.error(err);
	});
	return request;
};

IO.decodeAudio = (ab, cb) => {
	if (P.audioContext) {
		decodeADPCMAudio(ab, (err, buffer) => {
			if (buffer) return setTimeout(() => { cb(buffer); });
			const p = P.audioContext.decodeAudioData(ab, buffer => {
				cb(buffer);
			}, err2 => {
				console.warn(err, err2);
				cb(null);
			});
			if (p.catch) p.catch(() => {});
		});
	} else {
		setTimeout(cb);
	}
};

IO.loadBase = data => {
	data.scripts = data.scripts || [];
	data.costumes = IO.loadArray(data.costumes, IO.loadCostume);
	data.sounds = IO.loadArray(data.sounds, IO.loadSound);
	data.variables = data.variables || [];
	data.lists = data.lists || [];
};

IO.loadArray = (data, process) => {
	if (!data) return [];
	for (let i = 0; i < data.length; i++) {
		process(data[i]);
	}
	return data;
};

IO.loadObject = data => {
	if (!data.cmd && !data.listName) {
		IO.loadBase(data);
	}
};

IO.loadCostume = data => {
	IO.loadMD5(data.baseLayerMD5, data.baseLayerID, asset => {
		data.$image = asset;
	});
	if (data.textLayerMD5) {
		IO.loadMD5(data.textLayerMD5, data.textLayerID, asset => {
			data.$text = asset;
		});
	}
};

IO.loadSound = data => {
	IO.loadMD5(data.md5, data.soundID, asset => {
		data.$buffer = asset;
	});
};

IO.loadMD5 = (md5, id, callback) => {
	let file;
	let onloadCallback;
	const fileExtension = md5.split('.').pop();
	if (IO.zip) {
		file = IO.zip.file(`${id}.${fileExtension}`);
		md5 = file.name;
	}
	if (fileExtension === 'svg') {
		onloadCallback = source => {
			const parser = new DOMParser();
			let doc = parser.parseFromString(source, 'image/svg+xml');
			let svg = doc.documentElement;
			if (!svg.style) {
				doc = parser.parseFromString('<body>' + source, 'text/html');
				svg = doc.querySelector('svg');
			}
			svg.style.visibility = 'hidden';
			svg.style.position = 'absolute';
			svg.style.left = '-10000px';
			svg.style.top = '-10000px';
			document.body.appendChild(svg);
			const viewBox = svg.viewBox.baseVal;
			if (viewBox && (viewBox.x || viewBox.y)) {
				svg.width.baseVal.value = viewBox.width - viewBox.x;
				svg.height.baseVal.value = viewBox.height - viewBox.y;
				viewBox.x = 0;
				viewBox.y = 0;
				viewBox.width = 0;
				viewBox.height = 0;
			}
			fixSVG(svg, svg);
			document.body.removeChild(svg);
			svg.style.visibility = svg.style.position = svg.style.left = svg.style.top = '';

			const canvas = document.createElement('canvas');
			const image = new Image();
			callback(image);
			// svg.style.cssText = '';
			// console.log(md5, 'data:image/svg+xml;base64,' + btoa(div.innerHTML.trim()));
			canvg(canvas, new XMLSerializer().serializeToString(svg), {
				ignoreMouse: true,
				ignoreAnimation: true,
				ignoreClear: true,
				renderCallback () {
					image.src = canvas.toDataURL();
				}
			});
		};
		if (IO.zip) {
			onloadCallback(file.asText());
		} else {
			IO.projectRequest.add(IO.load(IO.ASSET_URL + md5 + '/get/', onloadCallback));
		}
	} else if (fileExtension === 'wav') {
		const request = new Request.Request();
		onloadCallback = ab => {
			IO.decodeAudio(ab, buffer => {
				callback(buffer);
				request.load(buffer);
			});
		};
		IO.projectRequest.add(request);
		if (IO.zip) {
			const ab = file.asArrayBuffer();
			onloadCallback(ab);
		} else {
			IO.projectRequest.add(IO.load(IO.ASSET_URL + md5 + '/get/', onloadCallback, 'arraybuffer'));
		}
	} else if (IO.zip) {
		const request = new Request.Request();
		const image = new Image();
		image.onload = () => {
			if (callback) callback(image);
			request.load();
		};
		image.src = `data:image/${(fileExtension === 'jpg' ? 'jpeg' : fileExtension)};base64,${btoa(file.asBinary())}`;
		IO.projectRequest.add(request);
	} else {
		IO.projectRequest.add(
			IO.loadImage(IO.ASSET_URL + md5 + '/get/', result => {
				callback(result);
			}));
	}
};

module.exports = IO;
