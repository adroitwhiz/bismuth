const Stage = require("./stage");
const canvg = require("canvg");
const Request = require("./request");
const JSZip = require("jszip");

const wavFiles = require("./instrument-wavs");

const IO = {};

IO.PROJECT_URL = 'https://projects.scratch.mit.edu/internalapi/project/';
IO.ASSET_URL = 'https://cdn.assets.scratch.mit.edu/internalapi/asset/';
IO.SOUNDBANK_URL = 'https://cdn.rawgit.com/LLK/scratch-flash/v429/src/soundbank/';

IO.FONTS = {
	'': 'Helvetica',
	Donegal: 'Donegal One',
	Gloria: 'Gloria Hallelujah',
	Marker: 'Permanent Marker',
	Mystery: 'Mystery Quest'
};

IO.LINE_HEIGHTS = {
	'Helvetica': 1.13,
	'Donegal One': 1.25,
	'Gloria Hallelujah': 1.97,
	'Permanent Marker': 1.43,
	'Mystery Quest': 1.37
};

IO.ADPCM_STEPS = [7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767];
IO.ADPCM_INDEX = [-1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8];

IO.init = request => {
	IO.projectRequest = request;
	IO.zip = null;
};

IO.parseJSONish = json => {
	if (!/^\s*\{/.test(json)) throw new SyntaxError('Bad JSON');
	try {
		return JSON.parse(json);
	} catch (e) {}
	if (/[^,:{}\[\]0-9\.\-+EINaefilnr-uy \n\r\t]/.test(json.replace(/"(\\.|[^"\\])*"/g, ''))) {
		throw new SyntaxError('Bad JSON');
	}
	return (1, eval)('(' + json + ')'); //yes thank you nathan. wtf??
};


IO.load = (url, callback, self, type) => {
	const request = new Request.Request;
	const xhr = new XMLHttpRequest;
	xhr.open('GET', url, true);
	xhr.onprogress = e => {
		request.progress(e.loaded, e.total, e.lengthComputable);
	};
	xhr.onload = () => {
		if (xhr.status === 200) {
			request.load(xhr.response);
		} else {
			request.error(new Error('HTTP ' + xhr.status + ': ' + xhr.statusText));
		}
	};
	xhr.onerror = () => {
		request.error(new Error('XHR Error'));
	};
	xhr.responseType = type || '';
	setTimeout(xhr.send.bind(xhr));

	if (callback) request.onLoad(callback.bind(self));
	return request;
};

IO.loadImage = (url, callback, self) => {
	const request = new Request.Request;
	const image = new Image;
	image.crossOrigin = 'anonymous';
	image.src = url;
	image.onload = () => {
		request.load(image);
	};
	image.onerror = () => {
		request.error(new Error('Failed to load image: ' + url));
	};
	if (callback) request.onLoad(callback.bind(self));
	return request;
};

IO.loadScratchr2Project = (id, callback, self) => {
	const request = new Request.CompositeRequest;
	IO.init(request);

	request.defer = true;
	const url = IO.PROJECT_URL + id + '/get/';
	request.add(IO.load(url).onLoad(contents => {
		try {
			var json = IO.parseJSONish(contents);
		} catch (e) {
			request.add(IO.load(url, null, null, 'arraybuffer').onLoad(ab => {
				const request2 = new Request.Request;
				request.add(request2);
				request.add(IO.loadSB2Project(ab, stage => {
					request.getResult = () => stage;
					request2.load();
				}));
				request.defer = false;
			}));
			return;
		}
		try {
			IO.loadProject(json);
			if (callback) request.onLoad(callback.bind(self));
			if (request.isDone) {
				request.load(new Stage().fromJSON(json));
			} else {
				request.defer = false;
				request.getResult = () => new Stage().fromJSON(json);
			}
		} catch (e) {
			request.error(e);
		}
	}));

	return request;
};

IO.loadScratchr2ProjectTitle = (id, callback, self) => {
	const request = new Request.CompositeRequest;

	request.defer = true;
	request.add(P.IO.load('https://scratch.mit.edu/projects/' + id + '/').onLoad(data => {
		const m = /<title>\s*(.+?)(\s+on\s+Scratch)?\s*<\/title>/.exec(data);
		if (callback) request.onLoad(callback.bind(self));
		if (m) {
			const d = document.createElement('div');
			d.innerHTML = m[1];
			request.load(d.innerText);
		} else {
			request.error(new Error('No title'));
		}
	}));

	return request;
};

IO.loadJSONProject = (json, callback, self) => {
	const request = new Request.CompositeRequest;
	IO.init(request);

	try {
		IO.loadProject(json);
		if (callback) request.onLoad(callback.bind(self));
		if (request.isDone) {
			request.load(new Stage().fromJSON(json));
		} else {
			request.defer = false;
			request.getResult = () => new Stage().fromJSON(json);
		}
	} catch (e) {
		request.error(e);
	}

	return request;
};

IO.loadSB2Project = (ab, callback, self) => {
	const request = new Request.CompositeRequest;
	IO.init(request);

	try {
		IO.zip = Object.prototype.toString.call(ab) === '[object ArrayBuffer]' ? new JSZip(ab) : ab;
		const json = IO.parseJSONish(IO.zip.file('project.json').asText());

		IO.loadProject(json);
		if (callback) request.onLoad(callback.bind(self));
		if (request.isDone) {
			request.load(new Stage().fromJSON(json));
		} else {
			request.defer = false;
			request.getResult = () => new Stage().fromJSON(json);
		}
	} catch (e) {
		request.error(e);
	}

	return request;
};

IO.loadSB2File = (f, callback, self) => {
	const cr = new Request.CompositeRequest;
	cr.defer = true;
	const request = new Request.Request;
	cr.add(request);
	const reader = new FileReader;
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
	reader.readAsArrayBuffer(f);
	if (callback) cr.onLoad(callback.bind(self));
	return cr;
};

IO.loadProject = data => {
	IO.loadWavs();
	IO.loadArray(data.children, IO.loadObject);
	IO.loadBase(data);
};

IO.wavBuffers = Object.create(null);
IO.loadWavs = () => {
	if (!audioContext) return;

	for (const name in wavFiles) {
		if (IO.wavBuffers[name]) {
			if (IO.wavBuffers[name] instanceof Request.Request) {
				IO.projectRequest.add(IO.wavBuffers[name]);
			}
		} else {
			IO.projectRequest.add(IO.wavBuffers[name] = IO.loadWavBuffer(name));
		}
	}
};

IO.loadWavBuffer = name => {
	const request = new Request.Request;
	IO.load(IO.SOUNDBANK_URL + wavFiles[name], ab => {
		IO.decodeAudio(ab, buffer => {
			IO.wavBuffers[name] = buffer;
			request.load();
		});
	}, null, 'arraybuffer').onError(err => {
		request.error(err);
	});
	return request;
};

IO.decodeAudio = (ab, cb) => {
	if (audioContext) {
		IO.decodeADPCMAudio(ab, (err, buffer) => {
			if (buffer) return setTimeout(() => {cb(buffer)});
			const p = audioContext.decodeAudioData(ab, buffer => {
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

IO.decodeADPCMAudio = (ab, cb) => {
	const dv = new DataView(ab);
	if (dv.getUint32(0) !== 0x52494646 || dv.getUint32(8) !== 0x57415645) {
		return cb(new Error('Unrecognized audio format'));
	}

	const blocks = {};
	let i = 12;
	const l = dv.byteLength - 8;
	while (i < l) {
		blocks[String.fromCharCode(
			dv.getUint8(i),
			dv.getUint8(i + 1),
			dv.getUint8(i + 2),
			dv.getUint8(i + 3))] = i;
		i += 8 + dv.getUint32(i + 4, true);
	}

	const format        = dv.getUint16(20, true);
	const channels      = dv.getUint16(22, true);
	const sampleRate    = dv.getUint32(24, true);
	const byteRate      = dv.getUint32(28, true);
	const blockAlign    = dv.getUint16(32, true);
	const bitsPerSample = dv.getUint16(34, true);

	if (format === 17) {
		const samplesPerBlock = dv.getUint16(38, true);
		const blockSize = ((samplesPerBlock - 1) / 2) + 4;

		const frameCount = dv.getUint32(blocks.fact + 8, true);

		const buffer = audioContext.createBuffer(1, frameCount, sampleRate);
		const channel = buffer.getChannelData(0);

		let sample, index = 0;
		let step, code, delta;
		let lastByte = -1;

		const offset = blocks.data + 8;
		i = offset;
		let j = 0;
		while (true) {
			if ((((i - offset) % blockSize) == 0) && (lastByte < 0)) {
				if (i >= dv.byteLength) break;
				sample = dv.getInt16(i, true); i += 2;
				index = dv.getUint8(i); i += 1;
				i++;
				if (index > 88) index = 88;
				channel[j++] = sample / 32767;
			} else {
				if (lastByte < 0) {
					if (i >= dv.byteLength) break;
					lastByte = dv.getUint8(i); i += 1;
					code = lastByte & 0xf;
				} else {
					code = (lastByte >> 4) & 0xf;
					lastByte = -1;
				}
				step = IO.ADPCM_STEPS[index];
				delta = 0;
				if (code & 4) delta += step;
				if (code & 2) delta += step >> 1;
				if (code & 1) delta += step >> 2;
				delta += step >> 3;
				index += IO.ADPCM_INDEX[code];
				if (index > 88) index = 88;
				if (index < 0) index = 0;
				sample += (code & 8) ? -delta : delta;
				if (sample > 32767) sample = 32767;
				if (sample < -32768) sample = -32768;
				channel[j++] = sample / 32768;
			}
		}
		return cb(null, buffer);
	}
	cb(new Error('Unrecognized WAV format ' + format));
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
	}, true);
};

IO.fixSVG = (svg, element) => {
	if (element.nodeType !== 1) return;
	if (element.nodeName === 'text') {
		let font = element.getAttribute('font-family') || '';
		font = IO.FONTS[font] || font;
		if (font) {
			element.setAttribute('font-family', font);
			if (font === 'Helvetica') element.style.fontWeight = 'bold';
		}
		let size = +element.getAttribute('font-size');
		if (!size) {
			element.setAttribute('font-size', size = 18);
		}
		const bb = element.getBBox();
		const x = 4 - .6 * element.transform.baseVal.consolidate().matrix.a;
		const y = (element.getAttribute('y') - bb.y) * 1.1;
		element.setAttribute('x', x);
		element.setAttribute('y', y);
		const lines = element.textContent.split('\n');
		if (lines.length > 1) {
			element.textContent = lines[0];
			const lineHeight = IO.LINE_HEIGHTS[font] || 1;
			for (let i = 1, l = lines.length; i < l; i++) {
				const tspan = document.createElementNS(null, 'tspan');
				tspan.textContent = lines[i];
				tspan.setAttribute('x', x);
				tspan.setAttribute('y', y + size * i * lineHeight);
				element.appendChild(tspan);
			}
		}
		// svg.style.cssText = '';
		// console.log(element.textContent, 'data:image/svg+xml;base64,' + btoa(svg.outerHTML));
	} else if ((element.hasAttribute('x') || element.hasAttribute('y')) && element.hasAttribute('transform')) {
		element.setAttribute('x', 0);
		element.setAttribute('y', 0);
	}
	[].forEach.call(element.childNodes, IO.fixSVG.bind(null, svg));
};

IO.loadMD5 = (md5, id, callback, isAudio) => {
	if (IO.zip) {
		var f = isAudio ? IO.zip.file(id + '.wav') : IO.zip.file(id + '.gif') || IO.zip.file(id + '.png') || IO.zip.file(id + '.jpg') || IO.zip.file(id + '.svg');
		md5 = f.name;
	}
	const ext = md5.split('.').pop();
	if (ext === 'svg') {
		var cb = source => {
			const parser = new DOMParser();
			let doc = parser.parseFromString(source, 'image/svg+xml');
			let svg = doc.documentElement;
			if (!svg.style) {
				doc = parser.parseFromString('<body>'+source, 'text/html');
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
			IO.fixSVG(svg, svg);
			document.body.removeChild(svg);
			svg.style.visibility = svg.style.position = svg.style.left = svg.style.top = '';

			const canvas = document.createElement('canvas');
			const image = new Image;
			callback(image);
			// svg.style.cssText = '';
			// console.log(md5, 'data:image/svg+xml;base64,' + btoa(div.innerHTML.trim()));
			canvg(canvas, new XMLSerializer().serializeToString(svg), {
				ignoreMouse: true,
				ignoreAnimation: true,
				ignoreClear: true,
				renderCallback() {
					image.src = canvas.toDataURL();
				}
			});
		};
		if (IO.zip) {
			cb(f.asText());
		} else {
			IO.projectRequest.add(IO.load(IO.ASSET_URL + md5 + '/get/', cb));
		}
	} else if (ext === 'wav') {
		var request = new Request.Request;
		var cb = ab => {
			IO.decodeAudio(ab, buffer => {
				callback(buffer);
				request.load(buffer);
			});
		}
		IO.projectRequest.add(request);
		if (IO.zip) {
			const audio = new Audio;
			const ab = f.asArrayBuffer();
			cb(ab);
		} else {
			IO.projectRequest.add(IO.load(IO.ASSET_URL + md5 + '/get/', cb, null, 'arraybuffer'));
		}
	} else {
		if (IO.zip) {
			var request = new Request.Request;
			const image = new Image;
			image.onload = () => {
				if (callback) callback(image);
				request.load();
			};
			image.src = 'data:image/' + (ext === 'jpg' ? 'jpeg' : ext) + ';base64,' + btoa(f.asBinary());
			IO.projectRequest.add(request);
		} else {
			IO.projectRequest.add(
				IO.loadImage(IO.ASSET_URL + md5 + '/get/', result => {
					callback(result);
				}));
		}
	}
};

module.exports = IO;