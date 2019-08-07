module.exports = {
	extends: 'eslint:recommended',
	env: {
		'browser': true,
		'commonjs': true,
		'es6': true
	},
	globals: {
		'P': 'writable'
	},
	rules: {
		'quotes': ['error', 'single'],
		'no-prototype-builtins': 'off',
		'no-unused-vars': 'warn',
		'no-useless-escape': 'off',
		'no-constant-condition': ['error', {'checkLoops': false}]
	},
	parserOptions: {
		'es6': true
	},
	overrides: [
		{
			'files': ['**/compile.js', '**/compile2_old.js', '**/codegen-block.js'],
			'rules': {
				'no-undef': 'off',
				'no-redeclare': 'off'
			}
		},
		{
			'files': ['webpack.config.js'],
			'env': {
				'node': true
			}
		}
	]
}