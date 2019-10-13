const canvg = require('canvg');
const JSZip = require('jszip');

const Costume = require('./costume');
const Sound = require('./sound');
const Sprite = require('./sprite');
const Stage = require('./stage');
const Watcher = require('./watcher');

const Request = require('./request');
const SB2Parser = require('./codegen/parser-sb2');

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
				return loadPromise(assetURL, type);
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
		return loadPromise(IO.PROJECT_URL + this.projectID, 'text').then(parseJSONish);
	}

	loadProjectSB2 () {
		return loadPromise(IO.PROJECT_URL + this.projectID, 'arraybuffer');
	}
}

class ZipAssetLoader {
	constructor (zip) {
		this.zip = zip;
	}

	fetchAsset (md5, id, type) {
		const fileExtension = md5.split('.').pop();
		const file = this.zip.file(`${id}.${fileExtension}`);
		switch (type) {
			case 'arraybuffer': {
				return file.async('arraybuffer');
			}
			case 'text': {
				return file.async('string');
			}
			case 'image': {
				return file.async('base64').then(base64 => {
					const image = document.createElement('img');
					image.src = `data:image/${(fileExtension === 'jpg' ? 'jpeg' : fileExtension)};base64,${base64}`;
					return new Promise((resolve, reject) => {
						image.addEventListener('load', () => { resolve(image); });
						image.addEventListener('error', reject);
					});
				});
			}
			default: {
				return Promise.reject(new Error(`Unknown file data type '${type}'`));
			}
		}
	}

	loadProjectManifest () {
		return this.zip.file('project.json')
			.async('string')
			.then(parseJSONish);
	}
}

class ProjectV2Request extends Request {
	constructor () {
		super();
		this._totalAssets = 0;
		this._loader = null;

		return this;
	}

	progress () {
		this.dispatchEvent('progress', {
			loaded: this.loaded,
			total: this._totalAssets,
			lengthComputable: true
		});
	}

	/**
	 * Load a project from a .sb2 file.
	 * @param {ArrayBuffer} ab The SB2 file, in ArrayBuffer form.
	 */
	loadSB2 (ab) {
		return JSZip.loadAsync(ab).then(zip => {
			this._loader = new ZipAssetLoader(zip);

			return this.loadProject();
		});
	}

	loadFromID (id) {
		this._loader = new WebAssetLoader(id);

		// If loading the project fails, it may be because it's a compressed SB2 instead of a manifest file.
		// If that's the case, attempt to load it as one.
		return this.loadProject().catch((err) => {
			console.log(err);
			return this._loader.loadProjectSB2().then(this.loadSB2.bind(this));
		});
	}

	loadProject () {
		const stagePromise = this._loader.loadProjectManifest().then(this.loadStage.bind(this));
		const instrumentsPromise = IO.loadInstruments();

		return Promise.all([stagePromise, instrumentsPromise]).then(() => { return stagePromise; });
	}

	loadStage (stageData) {
		// Copy over Stage-specific properties
		const loadedStage = new Stage();
		loadedStage.tempoBPM = stageData.tempoBPM;

		return Promise.all([
			this.loadObject(stageData, loadedStage),
			Promise.all(stageData.children.map(
				obj => {
					if (obj.listName) return null;
					if (obj.cmd) return this.loadWatcher(obj, loadedStage);
					return this.loadSprite(obj, loadedStage);
				}
			))
		]).then(results => {
			const loadedChildren = results[1];

			for (const child of loadedChildren) {
				if (child instanceof Watcher) {
					loadedStage.allWatchers.push(child);
				} else if (child instanceof Sprite) {
					loadedStage.children.push(child);
				}
			}

			for (const watcher of loadedStage.allWatchers) {
				watcher.resolve();
			}

			loadedStage.updateBackdrop();

			return loadedStage;
		});
	}

	loadWatcher (watcherData, parentStage) {
		const loadedWatcher = new Watcher(parentStage);

		loadedWatcher.cmd = watcherData.cmd || 'getVar:';
		if (watcherData.color) {
			const c = (watcherData.color < 0 ? watcherData.color + 0x1000000 : watcherData.color).toString(16);
			this.color = '#000000'.slice(0, -c.length) + c;
		}
		loadedWatcher.isDiscrete = watcherData.isDiscrete === undefined ? true : watcherData.isDiscrete;
		loadedWatcher.label = watcherData.label || '';
		loadedWatcher.mode = watcherData.mode || 1;
		loadedWatcher.param = watcherData.param;
		loadedWatcher.sliderMax = watcherData.sliderMax === undefined ? 100 : watcherData.sliderMax;
		loadedWatcher.sliderMin = watcherData.sliderMin || 0;
		loadedWatcher.targetName = watcherData.target;
		loadedWatcher.visible = watcherData.visible === undefined ? true : watcherData.visible;
		loadedWatcher.x = watcherData.x || 0;
		loadedWatcher.y = watcherData.y || 0;

		return Promise.resolve(loadedWatcher);
	}

	// TODO: return Sprite object
	loadSprite (obj, parentStage) {
		// Copy over Sprite-specific properties
		const loadedSprite = new Sprite(parentStage);

		loadedSprite.scratchX = obj.scratchX;
		loadedSprite.scratchY = obj.scratchY;
		loadedSprite.scale = obj.scale;
		loadedSprite.direction = obj.direction;
		loadedSprite.rotationStyle = obj.rotationStyle;
		loadedSprite.isDraggable = obj.isDraggable;
		loadedSprite.visible = obj.visible;

		return this.loadObject(obj, loadedSprite);
	}

	/**
	 * Loads the base of an object into the specified object.
	 * @param {Object} srcObject
	 * @param {Object} dstObject
	 * @returns
	 */
	loadObject (srcObject, dstObject) {
		const costumePromises = srcObject.costumes ?
			Promise.all(srcObject.costumes.map(
				(costumeData, index) => this.loadCostume(costumeData, index, dstObject))
			) :
			Promise.reject(`${srcObject.objName} has no costumes`);

		const soundPromises = srcObject.sounds ?
			Promise.all(srcObject.sounds.map(this.loadSound.bind(this))) :
			Promise.resolve(null);

		return Promise.all([costumePromises, soundPromises]).then(results => {
			const costumes = results[0];
			const sounds = results[1];

			// Parse scripts into common format
			if (srcObject.scripts) {
				const parser = new SB2Parser();
				for (const script of srcObject.scripts) {
					dstObject.scripts.push(parser.parseScript(script));
				}
			}

			if (srcObject.variables) dstObject.addVariables(srcObject.variables);
			if (srcObject.lists) dstObject.addLists(srcObject.lists);
			if (sounds !== null) dstObject.addSounds(sounds);

			dstObject.costumes = costumes;
			dstObject.objName = srcObject.objName;
			dstObject.currentCostumeIndex = srcObject.currentCostumeIndex;

			return dstObject;
		});
	}

	loadCostume (costumeData, index, parentSprite) {
		this._totalAssets++;
		const loadedCostume = new Costume(index, parentSprite);

		loadedCostume.bitmapResolution = costumeData.bitmapResolution;
		loadedCostume.scale = 1 / costumeData.bitmapResolution;
		loadedCostume.costumeName = costumeData.costumeName;
		loadedCostume.rotationCenterX = costumeData.rotationCenterX;
		loadedCostume.rotationCenterY = costumeData.rotationCenterY;

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
				loadedCostume.baseLayer = asset;
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

				loadedCostume.baseLayer = combinedCanvas;
			});
		}

		return costumePromise.then(() => {
			this.loaded++;
			this.progress();
			loadedCostume.render();
			return loadedCostume;
		});
	}

	loadSound (soundData) {
		this._totalAssets++;
		return this._loader.fetchAsset(soundData.md5, soundData.soundID, 'arraybuffer')
			.then(IO.decodeAudio)
			.then(buffer => {
				this.loaded++;
				this.progress();
				return new Sound(soundData.soundName, buffer);
			});
	}
}

const loadPromise = (url, type) => {
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
		P.compile(project);
		rq.dispatchEvent('load', project);
	});

	return rq;
};

IO.loadScratchr2ProjectTitle = projectID => {
	return loadPromise(IO.PROJECT_API_URL + projectID).then(data => {
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
		P.compile(project);
		rq.dispatchEvent('load', project);
		if (callback) callback(project);
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
	return loadPromise(IO.SOUNDBANK_URL + instruments[name], 'arraybuffer')
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
