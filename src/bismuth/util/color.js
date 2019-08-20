class Color {
	static rgbToHsv (rgb) {
		const r = ((rgb >> 16) & 0xff) / 0xff;
		const g = ((rgb >> 8) & 0xff) / 0xff;
		const b = (rgb & 0xff) / 0xff;

		const min = Math.min(r, g, b);
		const max = Math.max(r, g, b);

		let h = 0;
		let s = 0;

		if (min !== max) {
			const f = (r === min) ? g - b : ((g === min) ? b - r : r - g);
			const i = (g === min) ? 5 : ((r === min) ? 3 : 1);
			h = ((i - (f / (max - min))) * 60) % 360;
			s = (max - min) / max;
		}

		return [h, s, max];
	}

	static hsvToRgb (h, s, v) {
		const i = Math.floor(h / 60);
		const f = (h / 60) - i;
		const p = v * (1 - s);
		const q = v * (1 - (s * f));
		const t = v * (1 - (s * (1 - f)));

		let r;
		let g;
		let b;

		switch (i) {
			default:
			case 0:
				r = v;
				g = t;
				b = p;
				break;
			case 1:
				r = q;
				g = v;
				b = p;
				break;
			case 2:
				r = p;
				g = v;
				b = t;
				break;
			case 3:
				r = p;
				g = q;
				b = v;
				break;
			case 4:
				r = t;
				g = p;
				b = v;
				break;
			case 5:
				r = v;
				g = p;
				b = q;
				break;
		}

		return [r, g, b];
	}

	static rgbToHsl (rgb) {
		const r = ((rgb >> 16) & 0xff) / 0xff;
		const g = ((rgb >> 8) & 0xff) / 0xff;
		const b = (rgb & 0xff) / 0xff;

		const min = Math.min(r, g, b);
		const max = Math.max(r, g, b);

		if (min === max) {
			return [0, 0, r * 100];
		}

		const c = max - min;
		const l = (min + max) / 2;
		const s = c / (1 - Math.abs((2 * l) - 1));

		let h;
		switch (max) {
			case r:
				h = (((g - b) / c) + 6) % 6;
				break;
			case g:
				h = ((b - r) / c) + 2;
				break;
			case b:
				h = ((r - g) / c) + 4;
				break;
		}
		h *= 60;

		return [h, s, l];
	}

	static rgbToLightness (rgb) {
		const r = ((rgb >> 16) & 0xff) / 0xff;
		const g = ((rgb >> 8) & 0xff) / 0xff;
		const b = (rgb & 0xff) / 0xff;

		return (Math.min(r, g, b) + Math.max(r, g, b)) / 2;
	}

	static hslToHsv (h, s, l) {
		const v = (s * Math.min(l, 1 - l)) + l;
		const outS = v === 0 ? 0 : 2 - (2 * l / v);

		return [h, outS, v];
	}
}

module.exports = Color;
