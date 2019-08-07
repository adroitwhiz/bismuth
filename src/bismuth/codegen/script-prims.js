class Literal {
	constructor (type, value) {
		this.type = type;
		this.value = value;
	}
}

class Block {
	constructor (opcode, args) {
		this.opcode = opcode;
		this.args = args;
	}
}

class Script {
	constructor (blocks) {
		this._blocks = blocks || [];
	}

	splice (n) {
		let spliced = this._blocks.splice(n);
		return new Script(spliced);
	}

	slice (n) {
		return new Script(this._blocks.slice(n));
	}

	get blocks () {
		return this._blocks;
	}

	get shifted () {
		return new Script(this._blocks.slice(1));
	}

	addBlock (block) {
		this._blocks.push(block);
	}
}

module.exports = {Literal, Block, Script};
