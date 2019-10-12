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
	xhr.send();

	if (callback) request.on('load', callback);
	return request;
};

IO.loadImage = url => {
	const request = new Request.Request();
	const image = new Image();
	image.crossOrigin = 'anonymous';
	image.src = url;

	if (image.complete) {
		request.load(image);
	} else {
		image.onload = () => {
			request.load(image);
		};
	}

	image.onerror = () => {
		request.error(new Error(`Failed to load image: ${url}`));
	};
	return request;
};

IO.loadScratchr2Project = id => {
	const projectRequest = new Request.CompositeRequest();
	IO.init(projectRequest);
	projectRequest.defer = true;

	const projectURL = IO.PROJECT_URL + id;
	projectRequest.add(IO.load(projectURL).on('load', contents => {
		try {
			const json = parseJSONish(contents);

			IO.loadProject(json).then((json) => {
				projectRequest.load(new Stage().fromJSON(json));
			});
		} catch (err) {
			// Some projects from the offline editor come in compressed .sb2 format.
			projectRequest.add(IO.load(projectURL, null, 'arraybuffer').on('load', ab => {
				projectRequest.add(IO.loadSB2Project(ab, stage => {
					projectRequest.load(stage);
				}));
			}));
			return;
		}
	}));

	return projectRequest;
};

IO.loadScratchr2ProjectTitle = projectID => {
	return new Promise((resolve, reject) => {
		P.IO.load(IO.PROJECT_API_URL + projectID).on('load', data => {
			const title = JSON.parse(data).title;
			if (title) {
				resolve(title);
			} else {
				reject(new Error('No title'));
			}
		});
	});
};

IO.loadSB2Project = (ab, callback) => {
	const request = new Request.CompositeRequest();
	IO.init(request);
	request.defer = true;

	try {
		IO.zip = ab instanceof ArrayBuffer ? new JSZip(ab) : ab;
		const json = parseJSONish(IO.zip.file('project.json').asText());
		if (callback) request.on('load', callback);

		IO.loadProject(json).then(json => {
			request.load(new Stage().fromJSON(json));
		});
	} catch (e) {
		request.error(e);
	}

	return request;
};

IO.loadSB2File = (file, callback) => {
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
	if (callback) cr.on('load', callback);
	return cr;
};

IO.loadProject = data => {
	return Promise.all([
		IO.loadInstruments(),
		...data.children.map(IO.loadObject),
		IO.loadBase(data)
	]).then(() => { return data; });
};

IO.instrumentBuffers = Object.create(null);
IO.loadInstruments = () => {
	if (!P.audioContext) return;

	const instrumentPromises = [];

	for (const name in instruments) {
		if (!IO.instrumentBuffers[name]) {
			const instrumentRequest = IO.loadInstrumentBuffer(name);
			IO.instrumentBuffers[name] = instrumentRequest;
			IO.projectRequest.add(instrumentRequest);

			instrumentPromises.push(new Promise(resolve => {
				instrumentRequest.on('load', resolve);
			}));
		}
	}

	return Promise.all(instrumentPromises);
};

IO.loadInstrumentBuffer = name => {
	return IO.load(IO.SOUNDBANK_URL + instruments[name], ab => {
		IO.decodeAudio(ab).then(buffer => {
			IO.instrumentBuffers[name] = buffer;
		});
	}, 'arraybuffer');
};

IO.decodeAudio = ab => {
	if (P.audioContext) {
		// TODO: try to decode natively first for performance?
		return decodeADPCMAudio(ab)
			.catch(() => {
				return new Promise((resolve, reject) => {
					// TODO: return null if decode fails rather than rejecting?
					P.audioContext.decodeAudioData(ab, resolve, reject);
				});
			});
	} else {
		return Promise.reject('No audio context');
	}
};

IO.loadBase = data => {
	const costumePromises = Promise.all(data.costumes.map(IO.loadCostume));
	const soundPromises = Promise.all(data.sounds.map(IO.loadSound));

	return Promise.all([costumePromises, soundPromises]).then(() => {
		data.scripts = data.scripts || [];
		data.variables = data.variables || [];
		data.lists = data.lists || [];
	});
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
		return IO.loadBase(data);
	}

	return Promise.resolve(null);
};

IO.loadCostume = data => {
	const baseLayerPromise = IO.loadMD5(data.baseLayerMD5, data.baseLayerID).then(asset => {
		data.$image = asset;
	});

	if (data.textLayerMD5) {
		const textLayerPromise = IO.loadMD5(data.textLayerMD5, data.textLayerID).then(asset => {
			data.$text = asset;
		});

		return Promise.all([baseLayerPromise, textLayerPromise]);
	}

	return baseLayerPromise;
};

IO.loadSound = data => {
	return IO.loadMD5(data.md5, data.soundID).then(asset => {
		data.$buffer = asset;
	});
};

const loadSVG = source => {
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
	// svg.style.cssText = '';
	// console.log(md5, 'data:image/svg+xml;base64,' + btoa(div.innerHTML.trim()));

	return new Promise(resolve => {
		canvg(canvas, new XMLSerializer().serializeToString(svg), {
			ignoreMouse: true,
			ignoreAnimation: true,
			ignoreClear: true,
			renderCallback: () => {
				image.src = canvas.toDataURL();
				if (image.complete) {
					resolve(image);
				} else {
					image.addEventListener('load', () => {
						resolve(image);
					});
				}
			}
		});
	});
};

IO.loadMD5 = (md5, id) => {
	let file;
	const fileExtension = md5.split('.').pop();
	if (IO.zip) {
		file = IO.zip.file(`${id}.${fileExtension}`);
		md5 = file.name;
	}

	return new Promise(callback => {
		switch (fileExtension) {
			case 'svg': {
				const onloadCallback = source => {
					loadSVG(source).then(callback);
				};
	
				if (IO.zip) {
					onloadCallback(file.asText());
				} else {
					const request = IO.load(IO.ASSET_URL + md5 + '/get/').on('load', onloadCallback);
					IO.projectRequest.add(request);
				}
	
				break;
			}
			// TODO: MP3
			case 'wav': {
				const onloadCallback = ab => {
					IO.decodeAudio(ab).then(buffer => {
						callback(buffer);
					});
				};
				if (IO.zip) {
					const ab = file.asArrayBuffer();
					onloadCallback(ab);
				} else {
					const request = IO.load(IO.ASSET_URL + md5 + '/get/', null, 'arraybuffer').on('load', onloadCallback);
					IO.projectRequest.add(request);
				}
	
				break;
			}
			case 'png':
			case 'jpg':
			case 'jpeg': {
				if (IO.zip) {
					const image = new Image();
					image.onload = () => {
						callback(image);
					};
					image.src = `data:image/${(fileExtension === 'jpg' ? 'jpeg' : fileExtension)};base64,${btoa(file.asBinary())}`;
				} else {
					const request = IO.loadImage(IO.ASSET_URL + md5 + '/get/').on('load', callback);
					IO.projectRequest.add(request);
				}
				break;
			}
			default: {
				console.warn(`Unknown file type '${fileExtension}'`);
				callback();
			}
		}
	});
};

module.exports = IO;
