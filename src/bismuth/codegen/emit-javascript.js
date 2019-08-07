const astring = require('astring');

const backpatchGenerator = backpatchMap => Object.assign({}, astring.baseGenerator, {
	BackpatchedContinuationID: function (node, state) {
		state.write(backpatchMap[node.value]);
	}
});

const generateJavascriptCode = (generator, ast) => {
	return astring.generate(ast, {generator: backpatchGenerator(generator.backpatchMap)});
};

module.exports = generateJavascriptCode;
