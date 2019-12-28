const loadJSJS = require('./jsjs-loader');
const fs = require('fs').promises;

fs.readFile('./src/bismuth/codegen/block-translators.jsjs')
	.then(file => {
		const jsjs = loadJSJS(file);
		console.log(jsjs);
	});
