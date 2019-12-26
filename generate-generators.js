const JSJSParser = require('./tools/jsjs-parser').parser;
const fs = require('fs').promises;

fs.readFile('src/bismuth/codegen/block-translators-new.js')
	.then(code => {
		console.log(JSON.stringify(JSJSParser.parse(code), null, '\t'));
	});
