const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

module.exports = {
	entry: './src/phosphorus/phosphorus.js',
	output: {
		filename: 'bundle.js',
		path: path.resolve(__dirname, 'dist')
	},
	plugins: [
		new CopyWebpackPlugin([
			{
				from:'src/app'
			}
		])
	],
	optimization: {
		minimize: false
	}
};