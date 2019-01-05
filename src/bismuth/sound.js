var Sound = function(data) {
  this.name = data.soundName;
  this.buffer = data.$buffer;
  this.duration = this.buffer ? this.buffer.duration : 0;
};

module.exports = Sound;