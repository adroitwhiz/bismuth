const Events = require('./events');

class Costume {
	constructor(data, index, base) {
		this.index = index;
		this.base = base;
		this.baseLayerID = data.baseLayerID;
		this.baseLayerMD5 = data.baseLayerMD5;
		this.baseLayer = data.$image;
		this.bitmapResolution = data.bitmapResolution || 1;
		this.scale = 1 / this.bitmapResolution;
		this.costumeName = data.costumeName;
		this.rotationCenterX = data.rotationCenterX;
		this.rotationCenterY = data.rotationCenterY;
		this.textLayer = data.$text;

		this.image = document.createElement('canvas');
		this.context = this.image.getContext('2d');

		this.render();
		this.baseLayer.onload = () => {
			this.render();
		};
		if (this.textLayer) {
			this.textLayer.onload = this.baseLayer.onload;
		}
	}

	render() {
		if (!this.baseLayer.width || this.textLayer && !this.textLayer.width) {
			return;
		}
		this.image.width = this.baseLayer.width;
		this.image.height = this.baseLayer.height;

		this.context.drawImage(this.baseLayer, 0, 0);
		if (this.textLayer) {
			this.context.drawImage(this.textLayer, 0, 0);
		}
		if (this.base.isStage && this.index == this.base.currentCostumeIndex) {
			setTimeout(() => {
				this.base.updateBackdrop();
			});
		}
	}
}

Events.addEvents(Costume, 'load');

module.exports = Costume;