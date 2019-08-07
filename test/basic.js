const tap = require('tap');

// Mock window
global.window = {};

const MockSprite = require('./mocks/mock-sprite');

const Parser = require('../src/bismuth/codegen/parser');
const CodeGenerator = require('../src/bismuth/codegen/code-generator');
const generateJavascriptCode = require('../src/bismuth/codegen/emit-javascript');

const sprite = new MockSprite();
const parser = new Parser();
const gen = new CodeGenerator(sprite);

const parsedScript = parser.parseScript([['+', 1, 1]]);

const func = gen.compileFunction(parsedScript);
const stringifiedFunc = generateJavascriptCode(gen, func);

console.log(func, stringifiedFunc, sprite.continuations);
