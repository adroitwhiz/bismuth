const JSJSParser = require('./jsjs-parser').parser;
const generateJSJS = require('./jsjs-emitter');

module.exports = source => {
	const ast = JSJSParser.parse(source);
	return generateJSJS(ast);
};
