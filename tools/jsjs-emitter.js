const astring = require('astring');

const stringifyNode = node => {
	const props = [];

	if (node.type === 'JSJSTemplateElement') {
		return node.expression;
	}

	for (const key in node) {
		if (
			node.hasOwnProperty(key) &&
			key !== 'start' &&
			key !== 'end' &&
			key !== 'raw'
		) {
			const propVal = node[key];

			let propNode;
			if (typeof propVal === 'object') {
				propNode = stringifyNode(propVal);
			} else {
				propNode = {type: 'Literal', value: propVal};
			}

			props.push({
				type: 'Property',
				key: {type: 'Literal', value: key},
				value: propNode,
				kind: 'init'
			});
		}
	}

	return {
		type: 'ObjectExpression',
		properties: props
	};
};

const generator = Object.assign({}, astring.baseGenerator, {
	JSJSExpression: function (node, state) {
		const contents = node.expression;
		const stringified = stringifyNode(contents);
		this[stringified.type](stringified, state);
	}
});

const generateJSJS = (ast, options) => {
	return astring.generate(ast, Object.assign({generator}, options));
};

module.exports = generateJSJS;
