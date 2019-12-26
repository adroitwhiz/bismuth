const JSJSParser = require('./jsjs-parser');
const espree = require('espree/lib/espree');
const acorn = require('acorn');

// Janky hack to allow ESLint to lint my custom JS-in-JS files. Sometimes it even works.
const p = espree()(acorn.Parser);
const p2 = p.extend(JSJSParser.ext(p));
exports.parseForESLint = (code, options) => {
	const parsed = p2.parse(code, options);
	return {
		ast: parsed
	};
};
