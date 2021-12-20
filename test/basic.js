const tap = require('tap');

// Mock window
global.window = {};

const MockSprite = require('./mocks/mock-sprite');

const SB2Parser = require('../src/bismuth/io/parser-sb2');
const CodeGenerator = require('../src/bismuth/codegen/code-generator');
const generateJavascriptCode = require('../src/bismuth/codegen/emit-javascript');

const sprite = new MockSprite();
const parser = new SB2Parser();
const gen = new CodeGenerator(sprite);

const parsedScript = parser.parseScript([0, 0, [['+', 1, 1]]]);

const func = gen.compileFunction(parsedScript);
const stringifiedFunc = generateJavascriptCode(gen, func);

console.log(stringifiedFunc);
