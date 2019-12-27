const {Parser} = require('acorn');

const plugin = h => {
	const acorn = h.acorn;

	const tt_jsjsOpen = new acorn.TokenType('{{', {beforeExpr: true, startsExpr: true});
	const tt_jsjsClose = new acorn.TokenType('}}', {beforeExpr: true, startsExpr: true});

	// This token context isn't currently used for anything
	/* const tc_jsjsExpr = new acorn.TokContext('{{...}}', false);

	tt_jsjsOpen.updateContext = function () {
		this.context.push(tc_jsjsExpr);
	};

	tt_jsjsClose.updateContext = function () {
		this.context.pop();
	}; */

	return class extends h {
		readToken (code) {
			if (
				code === 123 &&
				this.input.charCodeAt(this.pos + 1) === 123
			) {
				this.pos += 2;
				return this.finishToken(tt_jsjsOpen);
			} else if (
				// Ensure third character in a row isn't also '}' to avoid matching the first two braces of '}}}'
				// This allows block statements to be JSJS'd as '{{{...}}}'
				code === 125 &&
				this.input.charCodeAt(this.pos + 1) === 125 &&
				this.input.charCodeAt(this.pos + 2) !== 125
			) {
				this.pos += 2;
				return this.finishToken(tt_jsjsClose);
			} else if (
				this.curContext() !== acorn.tokContexts.b_tmpl &&
				code === 36 &&
				this.input.charCodeAt(this.pos + 1) === 123
			) {
				this.pos += 2;
				return this.finishToken(acorn.tokTypes.dollarBraceL);
			}

			return super.readToken(code);
		}

		parseExprAtom (refDestructuringErrors) {
			if (this.type === tt_jsjsOpen) {
				const startPos = this.start;
				const startLoc = this.startLoc;
				const node = this.startNodeAt(startPos, startLoc);
				const expr = this.jsjs_parseJSJSExpression();
				node.expression = expr;
				return this.finishNode(node, 'JSJSExpression');
			} else if (this.type === acorn.tokTypes.dollarBraceL) {
				const node = this.startNode();
				this.expect(acorn.tokTypes.dollarBraceL);
				const expr = this.parseExpression();
				this.expect(acorn.tokTypes.braceR);
				node.expression = expr;
				return this.finishNode(node, 'JSJSTemplateElement');
			}

			return super.parseExprAtom(refDestructuringErrors);
		}

		jsjs_parseJSJSExpression () {
			this.expect(tt_jsjsOpen);
			const val = this.parseStatement();
			this.expect(tt_jsjsClose);
			return val;
		}
	};
};

const ext = Parser => {
	return () => plugin(Parser);
};

module.exports = {parser: Parser.extend(ext(Parser)), ext: ext};
