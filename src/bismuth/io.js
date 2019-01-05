const Stage = require("./stage");
const inherits = require("./inherits");
const canvg = require("canvg");

var addEvents = function(cla /*, events... */) {
	[].slice.call(arguments, 1).forEach(function(event) {
		addEvent(cla, event);
	});
};

var addEvent = function(cla, event) {
	var capital = event[0].toUpperCase() + event.substr(1);

	cla.prototype.addEventListener = cla.prototype.addEventListener || function(event, listener) {
		var listeners = this['$' + event] = this['$' + event] || [];
		listeners.push(listener);
		return this;
	};

	cla.prototype.removeEventListener = cla.prototype.removeEventListener || function(event, listener) {
		var listeners = this['$' + event];
		if (listeners) {
			var i = listeners.indexOf(listener);
			if (i !== -1) {
				listeners.splice(i, 1);
			}
		}
		return this;
	};

	cla.prototype.dispatchEvent = cla.prototype.dispatchEvent || function(event, arg) {
		var listeners = this['$' + event];
		if (listeners) {
			listeners.forEach(function(listener) {
				listener(arg);
			});
		}
		var listener = this['on' + event];
		if (listener) {
			listener(arg);
		}
		return this;
	};

	cla.prototype['on' + capital] = function(listener) {
		this.addEventListener(event, listener);
		return this;
	};

	cla.prototype['dispatch' + capital] = function(arg) {
		this.dispatchEvent(event, arg);
		return this;
	};
};

var wavFiles = {AcousticGuitar_F3:'instruments/AcousticGuitar_F3_22k.wav',AcousticPiano_As3:'instruments/AcousticPiano(5)_A%233_22k.wav',AcousticPiano_C4:'instruments/AcousticPiano(5)_C4_22k.wav',AcousticPiano_G4:'instruments/AcousticPiano(5)_G4_22k.wav',AcousticPiano_F5:'instruments/AcousticPiano(5)_F5_22k.wav',AcousticPiano_C6:'instruments/AcousticPiano(5)_C6_22k.wav',AcousticPiano_Ds6:'instruments/AcousticPiano(5)_D%236_22k.wav',AcousticPiano_D7:'instruments/AcousticPiano(5)_D7_22k.wav',AltoSax_A3:'instruments/AltoSax_A3_22K.wav',AltoSax_C6:'instruments/AltoSax(3)_C6_22k.wav',Bassoon_C3:'instruments/Bassoon_C3_22k.wav',BassTrombone_A2_2:'instruments/BassTrombone_A2(2)_22k.wav',BassTrombone_A2_3:'instruments/BassTrombone_A2(3)_22k.wav',Cello_C2:'instruments/Cello(3b)_C2_22k.wav',Cello_As2:'instruments/Cello(3)_A%232_22k.wav',Choir_F3:'instruments/Choir(4)_F3_22k.wav',Choir_F4:'instruments/Choir(4)_F4_22k.wav',Choir_F5:'instruments/Choir(4)_F5_22k.wav',Clarinet_C4:'instruments/Clarinet_C4_22k.wav',ElectricBass_G1:'instruments/ElectricBass(2)_G1_22k.wav',ElectricGuitar_F3:'instruments/ElectricGuitar(2)_F3(1)_22k.wav',ElectricPiano_C2:'instruments/ElectricPiano_C2_22k.wav',ElectricPiano_C4:'instruments/ElectricPiano_C4_22k.wav',EnglishHorn_D4:'instruments/EnglishHorn(1)_D4_22k.wav',EnglishHorn_F3:'instruments/EnglishHorn(1)_F3_22k.wav',Flute_B5_1:'instruments/Flute(3)_B5(1)_22k.wav',Flute_B5_2:'instruments/Flute(3)_B5(2)_22k.wav',Marimba_C4:'instruments/Marimba_C4_22k.wav',MusicBox_C4:'instruments/MusicBox_C4_22k.wav',Organ_G2:'instruments/Organ(2)_G2_22k.wav',Pizz_A3:'instruments/Pizz(2)_A3_22k.wav',Pizz_E4:'instruments/Pizz(2)_E4_22k.wav',Pizz_G2:'instruments/Pizz(2)_G2_22k.wav',SteelDrum_D5:'instruments/SteelDrum_D5_22k.wav',SynthLead_C4:'instruments/SynthLead(6)_C4_22k.wav',SynthLead_C6:'instruments/SynthLead(6)_C6_22k.wav',SynthPad_A3:'instruments/SynthPad(2)_A3_22k.wav',SynthPad_C6:'instruments/SynthPad(2)_C6_22k.wav',TenorSax_C3:'instruments/TenorSax(1)_C3_22k.wav',Trombone_B3:'instruments/Trombone_B3_22k.wav',Trumpet_E5:'instruments/Trumpet_E5_22k.wav',Vibraphone_C3:'instruments/Vibraphone_C3_22k.wav',Violin_D4:'instruments/Violin(2)_D4_22K.wav',Violin_A4:'instruments/Violin(3)_A4_22k.wav',Violin_E5:'instruments/Violin(3b)_E5_22k.wav',WoodenFlute_C5:'instruments/WoodenFlute_C5_22k.wav',BassDrum:'drums/BassDrum(1b)_22k.wav',Bongo:'drums/Bongo_22k.wav',Cabasa:'drums/Cabasa(1)_22k.wav',Clap:'drums/Clap(1)_22k.wav',Claves:'drums/Claves(1)_22k.wav',Conga:'drums/Conga(1)_22k.wav',Cowbell:'drums/Cowbell(3)_22k.wav',Crash:'drums/Crash(2)_22k.wav',Cuica:'drums/Cuica(2)_22k.wav',GuiroLong:'drums/GuiroLong(1)_22k.wav',GuiroShort:'drums/GuiroShort(1)_22k.wav',HiHatClosed:'drums/HiHatClosed(1)_22k.wav',HiHatOpen:'drums/HiHatOpen(2)_22k.wav',HiHatPedal:'drums/HiHatPedal(1)_22k.wav',Maracas:'drums/Maracas(1)_22k.wav',SideStick:'drums/SideStick(1)_22k.wav',SnareDrum:'drums/SnareDrum(1)_22k.wav',Tambourine:'drums/Tambourine(3)_22k.wav',Tom:'drums/Tom(1)_22k.wav',Triangle:'drums/Triangle(1)_22k.wav',Vibraslap:'drums/Vibraslap(1)_22k.wav',WoodBlock:'drums/WoodBlock(1)_22k.wav'};

var Request = function() {
	this.loaded = 0;
};
addEvents(Request, 'load', 'progress', 'error');

Request.prototype.progress = function(loaded, total, lengthComputable) {
	this.loaded = loaded;
	this.total = total;
	this.lengthComputable = lengthComputable;
	this.dispatchProgress({
		loaded: loaded,
		total: total,
		lengthComputable: lengthComputable
	});
};

Request.prototype.load = function(result) {
	this.result = result;
	this.isDone = true;
	this.dispatchLoad(result);
};

Request.prototype.error = function(error) {
	this.result = error;
	this.isError = true;
	this.isDone = true;
	this.dispatchError(error);
};

var CompositeRequest = function() {
	this.requests = [];
	this.isDone = true;
	this.update = this.update.bind(this);
	this.error = this.error.bind(this);
};
inherits(CompositeRequest, Request);

CompositeRequest.prototype.add = function(request) {
	if (request instanceof CompositeRequest) {
		for (var i = 0; i < request.requests.length; i++) {
			this.add(request.requests[i]);
		}
	} else {
		this.requests.push(request);
		request.addEventListener('progress', this.update);
		request.addEventListener('load', this.update);
		request.addEventListener('error', this.error);
		this.update();
	}
};

CompositeRequest.prototype.update = function() {
	if (this.isError) return;
	var requests = this.requests;
	var i = requests.length;
	var total = 0;
	var loaded = 0;
	var lengthComputable = true;
	var uncomputable = 0;
	var done = 0;
	while (i--) {
		var r = requests[i];
		loaded += r.loaded;
		if (r.isDone) {
			total += r.loaded;
			done += 1;
		} else if (r.lengthComputable) {
			total += r.total;
		} else {
			lengthComputable = false;
			uncomputable += 1;
		}
	}
	if (!lengthComputable && uncomputable !== requests.length) {
		var each = total / (requests.length - uncomputable) * uncomputable;
		i = requests.length;
		total = 0;
		loaded = 0;
		lengthComputable = true;
		while (i--) {
			var r = requests[i];
			if (r.lengthComputable) {
				loaded += r.loaded;
				total += r.total;
			} else {
				total += each;
				if (r.isDone) loaded += each;
			}
		}
	}
	this.progress(loaded, total, lengthComputable);
	this.doneCount = done;
	this.isDone = done === requests.length;
	if (this.isDone && !this.defer) {
		this.load(this.getResult());
	}
};

CompositeRequest.prototype.getResult = function() {
	throw new Error('Users must implement getResult()');
};

var IO = {};

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
	Helvetica: 1.13,
	'Donegal One': 1.25,
	'Gloria Hallelujah': 1.97,
	'Permanent Marker': 1.43,
	'Mystery Quest': 1.37
};

IO.ADPCM_STEPS = [7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767];
IO.ADPCM_INDEX = [-1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8];

IO.init = function(request) {
	IO.projectRequest = request;
	IO.zip = null;
};

IO.parseJSONish = function(json) {
	if (!/^\s*\{/.test(json)) throw new SyntaxError('Bad JSON');
	try {
		return JSON.parse(json);
	} catch (e) {}
	if (/[^,:{}\[\]0-9\.\-+EINaefilnr-uy \n\r\t]/.test(json.replace(/"(\\.|[^"\\])*"/g, ''))) {
		throw new SyntaxError('Bad JSON');
	}
	return (1, eval)('(' + json + ')');
};


IO.load = function(url, callback, self, type) {
	var request = new Request;
	var xhr = new XMLHttpRequest;
	xhr.open('GET', url, true);
	xhr.onprogress = function(e) {
		request.progress(e.loaded, e.total, e.lengthComputable);
	};
	xhr.onload = function() {
		if (xhr.status === 200) {
			request.load(xhr.response);
		} else {
			request.error(new Error('HTTP ' + xhr.status + ': ' + xhr.statusText));
		}
	};
	xhr.onerror = function() {
		request.error(new Error('XHR Error'));
	};
	xhr.responseType = type || '';
	setTimeout(xhr.send.bind(xhr));

	if (callback) request.onLoad(callback.bind(self));
	return request;
};

IO.loadImage = function(url, callback, self) {
	var request = new Request;
	var image = new Image;
	image.crossOrigin = 'anonymous';
	image.src = url;
	image.onload = function() {
		request.load(image);
	};
	image.onerror = function() {
		request.error(new Error('Failed to load image: ' + url));
	};
	if (callback) request.onLoad(callback.bind(self));
	return request;
};

IO.loadScratchr2Project = function(id, callback, self) {
	var request = new CompositeRequest;
	IO.init(request);

	request.defer = true;
	var url = IO.PROJECT_URL + id + '/get/';
	request.add(IO.load(url).onLoad(function(contents) {
		try {
			var json = IO.parseJSONish(contents);
		} catch (e) {
			request.add(IO.load(url, null, null, 'arraybuffer').onLoad(function(ab) {
				var request2 = new Request;
				request.add(request2);
				request.add(IO.loadSB2Project(ab, function(stage) {
					request.getResult = function() {
						return stage;
					};
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
				request.getResult = function() {
					return new Stage().fromJSON(json);
				};
			}
		} catch (e) {
			request.error(e);
		}
	}));

	return request;
};

IO.loadScratchr2ProjectTitle = function(id, callback, self) {
	var request = new CompositeRequest;

	request.defer = true;
	request.add(P.IO.load('https://scratch.mit.edu/projects/' + id + '/').onLoad(function(data) {
		var m = /<title>\s*(.+?)(\s+on\s+Scratch)?\s*<\/title>/.exec(data);
		if (callback) request.onLoad(callback.bind(self));
		if (m) {
			var d = document.createElement('div');
			d.innerHTML = m[1];
			request.load(d.innerText);
		} else {
			request.error(new Error('No title'));
		}
	}));

	return request;
};

IO.loadJSONProject = function(json, callback, self) {
	var request = new CompositeRequest;
	IO.init(request);

	try {
		IO.loadProject(json);
		if (callback) request.onLoad(callback.bind(self));
		if (request.isDone) {
			request.load(new Stage().fromJSON(json));
		} else {
			request.defer = false;
			request.getResult = function() {
				return new Stage().fromJSON(json);
			};
		}
	} catch (e) {
		request.error(e);
	}

	return request;
};

IO.loadSB2Project = function(ab, callback, self) {
	var request = new CompositeRequest;
	IO.init(request);

	try {
		IO.zip = Object.prototype.toString.call(ab) === '[object ArrayBuffer]' ? new JSZip(ab) : ab;
		var json = IO.parseJSONish(IO.zip.file('project.json').asText());

		IO.loadProject(json);
		if (callback) request.onLoad(callback.bind(self));
		if (request.isDone) {
			request.load(new Stage().fromJSON(json));
		} else {
			request.defer = false;
			request.getResult = function() {
				return new Stage().fromJSON(json);
			};
		}
	} catch (e) {
		request.error(e);
	}

	return request;
};

IO.loadSB2File = function(f, callback, self) {
	var cr = new CompositeRequest;
	cr.defer = true;
	var request = new Request;
	cr.add(request);
	var reader = new FileReader;
	reader.onloadend = function() {
		cr.defer = true;
		cr.add(IO.loadSB2Project(reader.result, function(result) {
			cr.defer = false;
			cr.getResult = function() {
				return result;
			};
			cr.update();
		}));
		request.load();
	};
	reader.onprogress = function(e) {
		request.progress(e.loaded, e.total, e.lengthComputable);
	};
	reader.readAsArrayBuffer(f);
	if (callback) cr.onLoad(callback.bind(self));
	return cr;
};

IO.loadProject = function(data) {
	IO.loadWavs();
	IO.loadArray(data.children, IO.loadObject);
	IO.loadBase(data);
};

IO.wavBuffers = Object.create(null);
IO.loadWavs = function() {
	if (!audioContext) return;

	for (var name in wavFiles) {
		if (IO.wavBuffers[name]) {
			if (IO.wavBuffers[name] instanceof Request) {
				IO.projectRequest.add(IO.wavBuffers[name]);
			}
		} else {
			IO.projectRequest.add(IO.wavBuffers[name] = IO.loadWavBuffer(name));
		}
	}
};

IO.loadWavBuffer = function(name) {
	var request = new Request;
	IO.load(IO.SOUNDBANK_URL + wavFiles[name], function(ab) {
		IO.decodeAudio(ab, function(buffer) {
			IO.wavBuffers[name] = buffer;
			request.load();
		});
	}, null, 'arraybuffer').onError(function(err) {
		request.error(err);
	});
	return request;
};

IO.decodeAudio = function(ab, cb) {
	if (audioContext) {
		IO.decodeADPCMAudio(ab, function(err, buffer) {
			if (buffer) return setTimeout(function() {cb(buffer)});
			var p = audioContext.decodeAudioData(ab, function(buffer) {
				cb(buffer);
			}, function(err2) {
				console.warn(err, err2);
				cb(null);
			});
			if (p.catch) p.catch(function() {});
		});
	} else {
		setTimeout(cb);
	}
};

IO.decodeADPCMAudio = function(ab, cb) {
	var dv = new DataView(ab);
	if (dv.getUint32(0) !== 0x52494646 || dv.getUint32(8) !== 0x57415645) {
		return cb(new Error('Unrecognized audio format'));
	}

	var blocks = {};
	var i = 12, l = dv.byteLength - 8;
	while (i < l) {
		blocks[String.fromCharCode(
			dv.getUint8(i),
			dv.getUint8(i + 1),
			dv.getUint8(i + 2),
			dv.getUint8(i + 3))] = i;
		i += 8 + dv.getUint32(i + 4, true);
	}

	var format        = dv.getUint16(20, true);
	var channels      = dv.getUint16(22, true);
	var sampleRate    = dv.getUint32(24, true);
	var byteRate      = dv.getUint32(28, true);
	var blockAlign    = dv.getUint16(32, true);
	var bitsPerSample = dv.getUint16(34, true);

	if (format === 17) {
		var samplesPerBlock = dv.getUint16(38, true);
		var blockSize = ((samplesPerBlock - 1) / 2) + 4;

		var frameCount = dv.getUint32(blocks.fact + 8, true);

		var buffer = audioContext.createBuffer(1, frameCount, sampleRate);
		var channel = buffer.getChannelData(0);

		var sample, index = 0;
		var step, code, delta;
		var lastByte = -1;

		var offset = blocks.data + 8;
		i = offset;
		var j = 0;
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

IO.loadBase = function(data) {
	data.scripts = data.scripts || [];
	data.costumes = IO.loadArray(data.costumes, IO.loadCostume);
	data.sounds = IO.loadArray(data.sounds, IO.loadSound);
	data.variables = data.variables || [];
	data.lists = data.lists || [];
};

IO.loadArray = function(data, process) {
	if (!data) return [];
	for (var i = 0; i < data.length; i++) {
		process(data[i]);
	}
	return data;
};

IO.loadObject = function(data) {
	if (!data.cmd && !data.listName) {
		IO.loadBase(data);
	}
};

IO.loadCostume = function(data) {
	IO.loadMD5(data.baseLayerMD5, data.baseLayerID, function(asset) {
		data.$image = asset;
	});
	if (data.textLayerMD5) {
		IO.loadMD5(data.textLayerMD5, data.textLayerID, function(asset) {
			data.$text = asset;
		});
	}
};

IO.loadSound = function(data) {
	IO.loadMD5(data.md5, data.soundID, function(asset) {
		data.$buffer = asset;
	}, true);
};

IO.fixSVG = function(svg, element) {
	if (element.nodeType !== 1) return;
	if (element.nodeName === 'text') {
		var font = element.getAttribute('font-family') || '';
		font = IO.FONTS[font] || font;
		if (font) {
			element.setAttribute('font-family', font);
			if (font === 'Helvetica') element.style.fontWeight = 'bold';
		}
		var size = +element.getAttribute('font-size');
		if (!size) {
			element.setAttribute('font-size', size = 18);
		}
		var bb = element.getBBox();
		var x = 4 - .6 * element.transform.baseVal.consolidate().matrix.a;
		var y = (element.getAttribute('y') - bb.y) * 1.1;
		element.setAttribute('x', x);
		element.setAttribute('y', y);
		var lines = element.textContent.split('\n');
		if (lines.length > 1) {
			element.textContent = lines[0];
			var lineHeight = IO.LINE_HEIGHTS[font] || 1;
			for (var i = 1, l = lines.length; i < l; i++) {
				var tspan = document.createElementNS(null, 'tspan');
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

IO.loadMD5 = function(md5, id, callback, isAudio) {
	if (IO.zip) {
		var f = isAudio ? IO.zip.file(id + '.wav') : IO.zip.file(id + '.gif') || IO.zip.file(id + '.png') || IO.zip.file(id + '.jpg') || IO.zip.file(id + '.svg');
		md5 = f.name;
	}
	var ext = md5.split('.').pop();
	if (ext === 'svg') {
		var cb = function(source) {
			var parser = new DOMParser();
			var doc = parser.parseFromString(source, 'image/svg+xml');
			var svg = doc.documentElement;
			if (!svg.style) {
				doc = parser.parseFromString('<body>'+source, 'text/html');
				svg = doc.querySelector('svg');
			}
			svg.style.visibility = 'hidden';
			svg.style.position = 'absolute';
			svg.style.left = '-10000px';
			svg.style.top = '-10000px';
			document.body.appendChild(svg);
			var viewBox = svg.viewBox.baseVal;
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

			var canvas = document.createElement('canvas');
			var image = new Image;
			callback(image);
			// svg.style.cssText = '';
			// console.log(md5, 'data:image/svg+xml;base64,' + btoa(div.innerHTML.trim()));
			canvg(canvas, new XMLSerializer().serializeToString(svg), {
				ignoreMouse: true,
				ignoreAnimation: true,
				ignoreClear: true,
				renderCallback: function() {
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
		var request = new Request;
		var cb = function(ab) {
			IO.decodeAudio(ab, function(buffer) {
				callback(buffer);
				request.load(buffer);
			});
		}
		IO.projectRequest.add(request);
		if (IO.zip) {
			var audio = new Audio;
			var ab = f.asArrayBuffer();
			cb(ab);
		} else {
			IO.projectRequest.add(IO.load(IO.ASSET_URL + md5 + '/get/', cb, null, 'arraybuffer'));
		}
	} else {
		if (IO.zip) {
			var request = new Request;
			var image = new Image;
			image.onload = function() {
				if (callback) callback(image);
				request.load();
			};
			image.src = 'data:image/' + (ext === 'jpg' ? 'jpeg' : ext) + ';base64,' + btoa(f.asBinary());
			IO.projectRequest.add(request);
		} else {
			IO.projectRequest.add(
				IO.loadImage(IO.ASSET_URL + md5 + '/get/', function(result) {
					callback(result);
				}));
		}
	}
};

module.exports = IO;