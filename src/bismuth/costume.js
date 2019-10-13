class Costume {
	constructor (index, base) {
		this.index = index;
		this.base = base;
		this.baseLayer = null;
		this.bitmapResolution = 1;
		this.scale = 1;
		this.costumeName = '';
		this.rotationCenterX = 0;
		this.rotationCenterY = 0;

		this.image = document.createElement('canvas');
		this.context = this.image.getContext('2d');
	}

	render () {
		if (!this.baseLayer.width || (this.textLayer && !this.textLayer.width)) {
			return;
		}
		this.image.width = this.baseLayer.width;
		this.image.height = this.baseLayer.height;

		this.context.drawImage(this.baseLayer, 0, 0);
	}
}

module.exports = Costume;
