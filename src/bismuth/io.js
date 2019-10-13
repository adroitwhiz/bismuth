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
IO.SOUNDBANK_URL = 'https://raw.githubusercontent.com/LLK/scratch-flash/v429/src/soundbank/';

class WebAssetLoader {
	constructor (projectID) {
		this.projectID = projectID;
	}

	fetchAsset (md5, id, type) {
		const assetURL = IO.ASSET_URL + md5 + '/get/';
		switch (type) {
			case 'arraybuffer':
			case 'text': {
				return IO.loadPromise(assetURL, type);
			}
			case 'image': {
				const image = document.createElement('img');
				image.crossOrigin = 'anonymous';
				image.src = assetURL;

				if (image.complete) {
					return Promise.resolve(image);
				} else {
					return new Promise((resolve, reject) => {
						image.onload = () => {
							resolve(image);
						};
						image.onerror = () => {
							reject(new Error(`Failed to load image: ${assetURL}`));
						};
					});
				}
			}
			default: {
				return Promise.reject(new Error(`Unknown file data type '${type}'`));
			}
		}
	}

	loadProjectManifest () {
		return IO.loadPromise(IO.PROJECT_URL + this.projectID, 'text').then(parseJSONish);
	}

	loadProjectSB2 () {
		return IO.loadPromise(IO.PROJECT_URL + this.projectID, 'arraybuffer');
	}
}

class ZipAssetLoader {
	constructor (zip) {
		this.zip = zip;
	}

	fetchAsset (md5, id, type) {
		const fileExtension = md5.split('.').pop();
		const file = this.zip.file(`${id}.${fileExtension}`);
		let loadedFile;
		switch (type) {
			case 'arraybuffer': {
				loadedFile = file.asArrayBuffer();
				break;
			}
			case 'text': {
				loadedFile = file.asText();
				break;
			}
			case 'image': {
				const image = document.createElement('img');
				image.src = `data:image/${(fileExtension === 'jpg' ? 'jpeg' : fileExtension)};base64,${btoa(file.asBinary())}`;
				return new Promise((resolve, reject) => {
					image.addEventListener('load', () => { resolve(image); });
					image.addEventListener('error', reject);
				});
			}
			default: {
				return Promise.reject(new Error(`Unknown file data type '${type}'`));
			}
		}
		return Promise.resolve(loadedFile);
	}

	loadProjectManifest () {
		return Promise.resolve(this.zip.file('project.json').asText()).then(parseJSONish);
	}
}

class ProjectV2Request {
	constructor () {
		this.totalAssets = 0;
		this.loadedAssets = 0;

		this._loader = null;

		this.project = null;

		this.listeners = {
			load: [],
			progress: [],
			error: []
		};

		return this;
	}

	get loaded () {
		return this.loadedAssets;
	}

	set loaded (numLoaded) {
		this.loadedAssets = numLoaded;
		this.dispatchEvent('progress', {
			loaded: numLoaded,
			total: this.totalAssets,
			lengthComputable: true
		});
	}

	get total () {
		return this.totalAssets;
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

	/**
	 * Load a project from a .sb2 file.
	 * @param {ArrayBuffer} ab The SB2 file, in ArrayBuffer form.
	 */
	loadSB2 (ab) {
		this._loader = new ZipAssetLoader(new JSZip(ab));

		return this.loadProject();
	}

	loadFromID (id) {
		this._loader = new WebAssetLoader(id);

		// If loading the project fails, it may be because it's a compressed SB2 instead of a manifest file.
		// If that's the case, attempt to load it as one.
		return this.loadProject().catch(() => {
			return this._loader.loadProjectSB2().then(this.loadSB2.bind(this));
		});
	}

	loadProject () {
		const stagePromise = this._loader.loadProjectManifest().then(this.loadStage.bind(this));
		const instrumentsPromise = IO.loadInstruments();

		return Promise.all([stagePromise, instrumentsPromise]).then(() => { return stagePromise; });
	}

	loadStage (obj) {
		// Copy over Stage-specific properties
		const loadedStage = {
			tempoBPM: obj.tempoBPM
		};

		return Promise.all([
			this.loadObject(obj, loadedStage),
			Promise.all(obj.children.map(this.loadSprite.bind(this)))
		]).then(results => {
			loadedStage.children = results[1];

			return loadedStage;
		});
	}

	loadSprite (obj) {
		// Copy over Sprite-specific properties
		const loadedSprite = {
			scratchX: obj.scratchX,
			scratchY: obj.scratchY,
			scale: obj.scale,
			direction: obj.direction,
			rotationStyle: obj.rotationStyle,
			isDraggable: obj.isDraggable,
			visible: obj.visible
		};

		return this.loadObject(obj, loadedSprite);
	}

	/**
	 * Loads the base of an object into the specified object.
	 * @param {Object} srcObject
	 * @param {Object} dstObject
	 * @returns
	 */
	loadObject (srcObject, dstObject) {
		// TODO: handle watchers better
		if (srcObject.cmd !== undefined || srcObject.listName !== undefined) {
			return Promise.resolve(srcObject);
		}

		const costumePromises = srcObject.costumes ?
			Promise.all(srcObject.costumes.map(this.loadCostume.bind(this))) :
			Promise.reject(`${srcObject.objName} has no costumes`);

		const soundPromises = srcObject.sounds ?
			Promise.all(srcObject.sounds.map(this.loadSound.bind(this))) :
			Promise.resolve([]);

		return Promise.all([costumePromises, soundPromises]).then(results => {
			dstObject.scripts = srcObject.scripts || [];
			dstObject.variables = srcObject.variables || [];
			dstObject.lists = srcObject.lists || [];
			dstObject.costumes = results[0];
			dstObject.sounds = results[1];
			dstObject.objName = srcObject.objName;

			return dstObject;
		});
	}

	// TODO: change to return Costume object
	loadCostume (costumeData) {
		this.totalAssets++;
		const loadedCostume = {
			costumeName: costumeData.costumeName,
			baseLayer: null,
			bitmapResolution: costumeData.bitmapResolution || 1,
			rotationCenterX: costumeData.rotationCenterX,
			rotationCenterY: costumeData.rotationCenterY,
			$image: null
		};

		// If the costume is an SVG, load the SVG as text and do fancy stuff with it.
		// Otherwise, load the costume as an <image>.
		let costumePromise;
		if (costumeData.baseLayerMD5.split('.').pop() === 'svg') {
			costumePromise = this._loader.fetchAsset(
				costumeData.baseLayerMD5,
				costumeData.baseLayerID,
				'text'
			).then(loadSVG);
		} else {
			costumePromise = this._loader.fetchAsset(
				costumeData.baseLayerMD5,
				costumeData.baseLayerID,
				'image'
			);
		}

		// After loading the costume and doing whatever needs to be done to it, add it to the costume.
		costumePromise = costumePromise
			// In case of failed costume load, create empty image to avoid crashing
			.catch(() => { return document.createElement('img'); })
			.then(asset => {
				loadedCostume.$image = asset;
			});

		if (costumeData.textLayerMD5) {
			// Combine text layer and base layer
			let textLayer;
			const textLayerPromise = this._loader.fetchAsset(
				costumeData.textLayerMD5,
				costumeData.textLayerID,
				'image'
			).then(asset => {
				textLayer = asset;
			});

			costumePromise = Promise.all([costumePromise, textLayerPromise]).then(() => {
				const combinedCanvas = document.createElement('canvas');
				combinedCanvas.width = costumeData.$image.naturalWidth;
				combinedCanvas.height = costumeData.$image.naturalHeight;

				const ctx = combinedCanvas.getContext('2d');
				ctx.drawImage(costumeData.$image, 0, 0);
				ctx.drawImage(textLayer, 0, 0);

				loadedCostume.$image = combinedCanvas;
			});
		}

		return costumePromise.then(() => { this.loaded++; return loadedCostume; });
	}

	// TODO: change to return Sound object
	loadSound (soundData) {
		this.totalAssets++;
		const loadedSound = {
			soundName: soundData.soundName,
			$buffer: null
		};

		return this._loader.fetchAsset(soundData.md5, soundData.soundID, 'arraybuffer')
			.then(IO.decodeAudio)
			.then(buffer => {
				this.loaded++;
				loadedSound.$buffer = buffer;
				return loadedSound;
			});
	}
}

IO.loadPromise = (url, type) => {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('GET', url, true);
		xhr.onload = () => {
			if (xhr.status === 200) {
				resolve(xhr.response);
			} else {
				reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
			}
		};
		xhr.onerror = () => {
			reject(new Error('XHR Error'));
		};
		xhr.responseType = type || '';
		xhr.send();
	});
};

IO.loadScratchr2Project = id => {
	const rq = new ProjectV2Request();

	rq.loadFromID(id).then(project => {
		const loaded = new Stage().fromJSON(project);
		rq.dispatchEvent('load', loaded);
	});

	return rq;
};

IO.loadScratchr2ProjectTitle = projectID => {
	return IO.loadPromise(IO.PROJECT_API_URL + projectID).then(data => {
		const title = JSON.parse(data).title;
		if (title) {
			return title;
		} else {
			throw new Error('No title');
		}
	});
};

IO.loadSB2Project = (ab, callback) => {
	const rq = new ProjectV2Request();
	rq.loadSB2(ab).then(project => {
		const loaded = new Stage().fromJSON(project);
		rq.dispatchEvent('load', loaded);
		if (callback) callback(loaded);
	});
	return rq;
};

IO.loadSB2File = (file, callback) => {
	const request = new Request();
	const reader = new FileReader();
	reader.onloadend = () => {
		const sb2Request = IO.loadSB2Project(reader.result);

		sb2Request.on('load', request.load.bind(request));
	};
	reader.onprogress = e => {
		request.progress(e.loaded, e.total, e.lengthComputable);
	};
	reader.readAsArrayBuffer(file);
	if (callback) request.on('load', callback);
	return request;
};

IO.instrumentBuffers = Object.create(null);
IO.loadInstruments = () => {
	if (!P.audioContext) return;
	const instrumentPromises = [];
	for (const name in instruments) {
		if (!IO.instrumentBuffers[name]) {
			instrumentPromises.push(IO.loadInstrumentBuffer(name));
		}
	}

	return Promise.all(instrumentPromises);
};

IO.loadInstrumentBuffer = name => {
	return IO.loadPromise(IO.SOUNDBANK_URL + instruments[name], 'arraybuffer')
		.then(IO.decodeAudio)
		.then(buffer => {
			IO.instrumentBuffers[name] = buffer;
		});
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

module.exports = IO;
