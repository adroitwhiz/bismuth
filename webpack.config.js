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
				from: 'src/app'
			}
		])
	],

	module: {
		rules: [
			{
				test: /.jsjs$/,
				use: [
					{
						loader: path.resolve(__dirname, 'tools/jsjs-loader.js')
					}
				]
			}
		]
	},

	devtool: 'cheap-module-source-map',
	devServer: {
		contentBase: path.resolve(__dirname, 'dist'),
		port: 9001,
		watchOptions: {
			poll: true
		}
	}
};
