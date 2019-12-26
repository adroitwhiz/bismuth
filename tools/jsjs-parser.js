const {Parser} = require('acorn');

const plugin = h => {
	const acorn = h.acorn;

	const jsjsBlock = new acorn.TokenType('jsjsBlock');

	return class extends h {
		readToken (code) {
			if (code === 123 && this.input.charCodeAt(this.pos + 1) === 123) {
				console.log('found opening bracket');
				let out = '';
				this.pos += 2;
				const chunkStart = this.pos;

				//const s = this.parseStatement();

				while (true) {
					if (this.pos >= this.input.length) this.raise(this.start, 'Unterminated JSJS block');

					const ch1 = this.input.charCodeAt(this.pos);
					const ch2 = this.input.charCodeAt(this.pos + 1);

					if (ch1 === 125 && ch2 === 125) {
						this.pos += 2;
						break;
					} else {
						++this.pos;
					}
				}

				out += this.input.slice(chunkStart, this.pos - 2);

				return this.finishToken(jsjsBlock, out);
			}

			return super.readToken(code);
		}

		parseExprAtom (refDestructuringErrors) {
			if (this.type === jsjsBlock) {
				const node = this.startNode();
				node.value = this.value;
				this.next();
				return this.finishNode(node, 'JSJSBlock');
			} else {
				return super.parseExprAtom(refDestructuringErrors);
			}
		}
	};
};

const ext = Parser => {
	return () => plugin(Parser);
};

module.exports = {parser: Parser.extend(ext(Parser)), ext: ext};
