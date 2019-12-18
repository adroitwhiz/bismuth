const JSZip = require('jszip');
const SvgRenderer = require('scratch-svg-renderer').SVGRenderer;

const Costume = require('./costume');
const Sound = require('./sound');
const Sprite = require('./sprite');
const Stage = require('./stage');
const Watcher = require('./watcher');

const Request = require('./request');
const SB2Parser = require('./codegen/parser-sb2');
const SB3Parser = require('./codegen/parser-sb3');

const decodeADPCMAudio = require('./io/decode-adpcm-audio.js');
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

class ProjectLoader {
	constructor (assetLoader, request) {
		this._numLoadedAssets = 0;
		this._numTotalAssets = 0;
		this._loader = null || assetLoader;
		this.request = null || request;
	}


	progress () {
		if (this.request !== null) {
			this.request.dispatchEvent('progress', {
				loaded: this._numLoadedAssets,
				total: this._numTotalAssets,
				lengthComputable: true
			});
		}
	}
}

class ProjectV2Loader extends ProjectLoader {
	constructor (assetLoader, request) {
		super(assetLoader, request);
		return this;
	}

	loadProject (manifest) {
		const stagePromise = this.loadStage(manifest);
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

		// Convert watcher opcode to new Scratch 3.0 opcode
		// TODO: figure out whether parser should be instantiated once per ProjectV2Loader
		const parser = new SB2Parser();
		const watcherBlock = parser.parseBlock([watcherData.cmd, watcherData.param]);

		loadedWatcher.opcode = watcherBlock.opcode;
		// Add field values to watcher's parameter map
		for (const arg of Object.values(watcherBlock.args)) {
			loadedWatcher.params[arg.name] = arg.value.value;
		}

		loadedWatcher.isDiscrete = watcherData.isDiscrete === undefined ? true : watcherData.isDiscrete;
		loadedWatcher.label = watcherData.label || '';

		// Convert Scratch 2.0 numeric watcher modes to new mode strings.
		// 3: slider mode, 2: large mode, 1: default mode
		// if mode not given, assume default mode
		switch (watcherData.mode) {
			case 3:
				loadedWatcher.mode = 'slider';
				break;
			case 2:
				loadedWatcher.mode = 'large';
				break;
			default:
				loadedWatcher.mode = 'default';
				break;
		}

		loadedWatcher.sliderMax = watcherData.sliderMax === undefined ? 100 : watcherData.sliderMax;
		loadedWatcher.sliderMin = watcherData.sliderMin || 0;
		loadedWatcher.targetName = watcherData.target;
		loadedWatcher.visible = watcherData.visible === undefined ? true : watcherData.visible;
		loadedWatcher.x = watcherData.x || 0;
		loadedWatcher.y = watcherData.y || 0;

		return Promise.resolve(loadedWatcher);
	}

	loadSprite (obj, parentStage) {
		// Copy over Sprite-specific properties
		const loadedSprite = new Sprite(parentStage);

		loadedSprite.scratchX = obj.scratchX;
		loadedSprite.scratchY = obj.scratchY;
		loadedSprite.size = obj.scale * 100;
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

			if (srcObject.variables) {
				for (const variable of srcObject.variables) {
					dstObject.addVariable(variable.name, variable.value);
				}
			}

			if (srcObject.lists) {
				for (const list of srcObject.lists) {
					dstObject.addList(list.listName, list.contents);
				}
			}

			if (sounds !== null) dstObject.addSounds(sounds);

			dstObject.costumes = costumes;
			dstObject.objName = srcObject.objName;
			dstObject.currentCostumeIndex = srcObject.currentCostumeIndex;

			return dstObject;
		});
	}

	loadCostume (costumeData, index, parentSprite) {
		this._numTotalAssets++;
		const loadedCostume = new Costume(index, parentSprite);

		loadedCostume.bitmapResolution = costumeData.bitmapResolution;
		loadedCostume.scale = 1 / costumeData.bitmapResolution;
		loadedCostume.costumeName = costumeData.costumeName;
		loadedCostume.rotationCenterX = costumeData.rotationCenterX;
		loadedCostume.rotationCenterY = costumeData.rotationCenterY;

		// If the costume is an SVG, load the SVG as text and do fancy stuff with it.
		// Otherwise, load the costume as an <img>.
		let costumePromise;
		if (costumeData.baseLayerMD5.split('.').pop() === 'svg') {
			costumePromise = this._loader.fetchAsset(
				costumeData.baseLayerMD5,
				costumeData.baseLayerID,
				'text'
			).then(costume => loadSVG(costume, true /* fromVersion2 */))
				.then(renderer => {
					loadedCostume.rotationCenterX -= renderer.viewOffset[0];
					loadedCostume.rotationCenterY -= renderer.viewOffset[1];
					return renderer.canvas;
				});
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
			this._numLoadedAssets++;
			this.progress();
			loadedCostume.render();
			return loadedCostume;
		});
	}

	loadSound (soundData) {
		this._numTotalAssets++;
		return this._loader.fetchAsset(soundData.md5, soundData.soundID, 'arraybuffer')
			.then(IO.decodeAudio)
			.then(buffer => {
				this._numLoadedAssets++;
				this.progress();
				return new Sound(soundData.soundName, buffer);
			});
	}
}

class ProjectV3Loader extends ProjectLoader {
	constructor (assetLoader, request) {
		super(assetLoader, request);
		return this;
	}

	loadProject (manifest) {
		return Promise.all(manifest.targets.map(this.loadTarget.bind(this)))
			.then(loadedTargets => {
				const stage = loadedTargets.find(target => target instanceof Stage);

				for (const child of loadedTargets) {
					if (child instanceof Watcher) {
						child.stage = stage;
						stage.allWatchers.push(child);
					} else if (child instanceof Sprite) {
						child.stage = stage;
						stage.children.push(child);
					}
				}

				// Currently, layer order is implicit. It's the position of the sprite in the stage's "children" array.
				stage.children.sort((a, b) => a.layerOrder - b.layerOrder);

				// Add and resolve watchers after all sprites are done loading
				for (const watcherData of manifest.monitors) {
					const watcher = this.loadWatcher(watcherData);
					watcher.stage = stage;
					stage.allWatchers.push(watcher);
					watcher.resolve();
				}

				stage.updateBackdrop();

				return stage;
			});
	}

	loadTarget (target) {
		const dstTarget = target.isStage ? new Stage() : new Sprite();

		// Scratch 3 variables come in an Object of this form:
		// {'some_long_ID': ['variable_name', variable_value]}
		for (const variable of Object.values(target.variables)) {
			dstTarget.addVariable(variable[0], variable[1]);
		}

		// Lists work the same way as variables
		for (const list of Object.values(target.lists)) {
			dstTarget.addList(list[0], list[1]);
		}

		dstTarget.objName = target.name;
		dstTarget.currentCostumeIndex = target.currentCostume;
		dstTarget.volume = target.volume;
		dstTarget.layerOrder = target.layerOrder;

		const parser = new SB3Parser();
		dstTarget.scripts = parser.parseBlocks(target.blocks);

		if (target.isStage) {
			dstTarget.tempoBPM = target.tempo;
		} else {
			dstTarget.scratchX = target.x;
			dstTarget.scratchY = target.y;
			dstTarget.size = target.size;
			dstTarget.direction = target.direction;
			// Map new rotation style strings to ones the runtime expects
			switch (target.rotationStyle) {
				case 'all around':
					dstTarget.rotationStyle = 'normal';
					break;
				case 'left-right':
					dstTarget.rotationStyle = 'leftRight';
					break;
				case 'don\'t rotate':
					dstTarget.rotationStyle = 'none';
					break;
			}

			dstTarget.isDraggable = target.draggable;
			dstTarget.visible = target.visible;
		}

		const costumePromises = Promise.all(target.costumes.map(
			(costumeData, index) => this.loadCostume(costumeData, index, target))
		);

		const soundPromises = Promise.all(target.sounds.map(this.loadSound.bind(this)));

		return Promise.all([costumePromises, soundPromises]).then(results => {
			const costumes = results[0];
			const sounds = results[1];

			dstTarget.costumes = costumes;
			dstTarget.addSounds(sounds);

			return dstTarget;
		});
	}

	loadCostume (costumeData, index, parentSprite) {
		this._numTotalAssets++;
		const loadedCostume = new Costume(index, parentSprite);

		loadedCostume.bitmapResolution = costumeData.bitmapResolution;
		loadedCostume.scale = 1 / costumeData.bitmapResolution;
		loadedCostume.costumeName = costumeData.name;
		loadedCostume.rotationCenterX = costumeData.rotationCenterX;
		loadedCostume.rotationCenterY = costumeData.rotationCenterY;

		// If the costume is an SVG, load the SVG as text and do fancy stuff with it.
		// Otherwise, load the costume as an <img>.
		let costumePromise;
		if (costumeData.dataFormat === 'svg') {
			costumePromise = this._loader.fetchAsset(
				costumeData.md5ext,
				costumeData.assetId,
				'text'
			).then(costume => loadSVG(costume, false /* fromVersion2 */))
				.then(renderer => {
					loadedCostume.rotationCenterX -= renderer.viewOffset[0];
					loadedCostume.rotationCenterY -= renderer.viewOffset[1];
					return renderer.canvas;
				});
		} else {
			costumePromise = this._loader.fetchAsset(
				costumeData.md5ext,
				costumeData.assetId,
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

		return costumePromise.then(() => {
			this._numLoadedAssets++;
			this.progress();
			loadedCostume.render();
			return loadedCostume;
		});
	}

	loadSound (soundData) {
		this._numTotalAssets++;
		return this._loader.fetchAsset(soundData.md5ext, soundData.assetId, 'arraybuffer')
			.then(IO.decodeAudio)
			.then(buffer => {
				this._numLoadedAssets++;
				this.progress();
				return new Sound(soundData.name, buffer);
			});
	}

	loadWatcher (watcherData) {
		const loadedWatcher = new Watcher();

		loadedWatcher.opcode = watcherData.opcode;
		loadedWatcher.params = watcherData.params;

		loadedWatcher.isDiscrete = watcherData.isDiscrete;
		loadedWatcher.label = '';
		loadedWatcher.mode = watcherData.mode;
		loadedWatcher.sliderMax = watcherData.sliderMax;
		loadedWatcher.sliderMin = watcherData.sliderMin;
		loadedWatcher.targetName = watcherData.spriteName;
		loadedWatcher.visible = watcherData.visible;
		loadedWatcher.x = watcherData.x;
		loadedWatcher.y = watcherData.y;

		return loadedWatcher;
	}
}

class ProjectRequest extends Request {
	constructor () {
		super();
	}

	_loadProject (assetLoader) {
		return assetLoader.loadProjectManifest().then(manifest => {
			let projectLoader;
			// Scratch 3.0 project .jsons have a 'meta', 2.0 project .jsons have an 'info'
			if (manifest.meta) {
				projectLoader = new ProjectV3Loader(assetLoader, this);
			} else {
				projectLoader = new ProjectV2Loader(assetLoader, this);
			}
			return projectLoader.loadProject(manifest);
		});
	}

	/**
	 * Load a project from a .sb2 or .sb3 file.
	 * @param {ArrayBuffer} ab The SB2 or SB3 file, in ArrayBuffer form.
	 */
	loadFromFile (ab) {
		return JSZip.loadAsync(ab).then(zip => {
			const assetLoader = new ZipAssetLoader(zip);

			return this._loadProject(assetLoader);
		});
	}

	/**
	 * Load the project with the given Scratch project ID.
	 * @param {string} id The project ID.
	 */
	loadFromID (id) {
		const assetLoader = new WebAssetLoader(id);

		// If loading the project fails, it may be because it's a compressed SB2 instead of a manifest file.
		// If that's the case, attempt to load it as one.
		return this._loadProject(assetLoader).catch((err) => {
			console.warn(err);
			return assetLoader.loadProjectSB2().then(this.loadFromFile.bind(this));
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

const loadSVG = (source, fromVersion2) => {
	return new Promise(resolve => {
		const renderer = new SvgRenderer();
		renderer.loadSVG(source, fromVersion2, () => {
			try {
				renderer.draw();
			} catch (err) {
				renderer.canvas.width = 1;
				renderer.canvas.height = 1;
			}
			resolve(renderer);
		});
	});
};

IO.loadScratchr2Project = id => {
	const rq = new ProjectRequest();

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
	const rq = new ProjectRequest();
	rq.loadFromFile(ab).then(project => {
		P.compile(project);
		rq.dispatchEvent('load', project);
		if (callback) callback(project);
	});
	return rq;
};

IO.loadProjectFile = (file, callback) => {
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

module.exports = IO;
