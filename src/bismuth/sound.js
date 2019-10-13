class Sound {
	constructor (name, buffer) {
		this.name = name;
		this.buffer = buffer;
		this.duration = buffer ? buffer.duration : 0;
	}
}

module.exports = Sound;
