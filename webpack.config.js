const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

module.exports = {
	mode: 'development',
	entry: './src/bismuth/bismuth.js',
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

	devtool: 'cheap-module-source-map',	
	devServer: {
		contentBase: path.resolve(__dirname, 'dist'),
		port: 9001,
		watchOptions: {
			poll: true
		}
	}
};
