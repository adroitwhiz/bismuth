const FONTS = {
	'': 'Helvetica',
	Donegal: 'Donegal One',
	Gloria: 'Gloria Hallelujah',
	Marker: 'Permanent Marker',
	Mystery: 'Mystery Quest'
};

const LINE_HEIGHTS = {
	'Helvetica': 1.13,
	'Donegal One': 1.25,
	'Gloria Hallelujah': 1.97,
	'Permanent Marker': 1.43,
	'Mystery Quest': 1.37
};

const fixSVG = (svg, element) => {
	if (element.nodeType !== 1) return;
	if (element.nodeName === 'text') {
		let font = element.getAttribute('font-family') || '';
		font = FONTS[font] || font;
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
			const lineHeight = LINE_HEIGHTS[font] || 1;
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
	Array.prototype.forEach.call(element.childNodes, fixSVG.bind(null, svg));
};

module.exports = fixSVG;