module.exports = {
	extends: 'eslint:recommended',
	env: {
		'browser': true,
		'commonjs': true,
		'es6': true
	},
	rules: {
		'quotes': ['error', 'single']
	},
	parserOptions: {
		'es6': true
	}
}