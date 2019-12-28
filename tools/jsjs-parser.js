const {Parser} = require('acorn');

const plugin = h => {
	const acorn = h.acorn;

	const tt_jsjsExprOpen = new acorn.TokenType('::{');
	const tt_jsjsStatementOpen = new acorn.TokenType('{{');
	const tt_jsjsClose = new acorn.TokenType('}}');

	const tt_jsjsTmplOpen = new acorn.TokenType('${');

	// This token context isn't currently used for anything
	const tc_jsjsStatement = new acorn.TokContext('{{...}}', false);
	const tc_jsjsExpression = new acorn.TokContext('::{...}', false);
	const tc_jsjsTemplate = new acorn.TokContext('JSJS_${', true);

	tt_jsjsStatementOpen.updateContext = function () {
		this.context.push(tc_jsjsStatement);
	};

	tt_jsjsClose.updateContext = function () {
		this.context.pop();
	};

	tt_jsjsExprOpen.updateContext = function () {
		this.context.push(tc_jsjsExpression);
		this.exprAllowed = false;
	};

	tt_jsjsTmplOpen.updateContext = function () {
		this.context.push(tc_jsjsTemplate);
	};

	return class extends h {
		readToken (code) {
			if (
				code === 123 &&
				this.input.charCodeAt(this.pos + 1) === 123
			) {
				this.pos += 2;
				return this.finishToken(tt_jsjsStatementOpen);
			} else if (
				code === 58 &&
				this.input.charCodeAt(this.pos + 1) === 58 &&
				this.input.charCodeAt(this.pos + 2) === 123
			) {
				this.pos += 3;
				return this.finishToken(tt_jsjsExprOpen);
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
				return this.finishToken(tt_jsjsTmplOpen);
			}

			return super.readToken(code);
		}

		parseExprAtom (refDestructuringErrors) {
			if (this.type === tt_jsjsStatementOpen ||
				this.type === tt_jsjsExprOpen) {
				const node = this.startNodeAt(this.start, this.startLoc);
				if (this.type === tt_jsjsStatementOpen) {
					node.expression = this.jsjs_parseJSJSStatement();
				} else {
					node.expression = this.jsjs_parseJSJSExpression();
				}
				return this.finishNode(node, 'JSJSExpression');
			} else if (this.type === tt_jsjsTmplOpen) {
				const node = this.startNodeAt(this.start, this.startLoc);
				this.expect(tt_jsjsTmplOpen);
				const expr = this.parseExpression();
				this.expect(acorn.tokTypes.braceR);
				node.expression = expr;
				return this.finishNode(node, 'JSJSTemplateElement');
			}

			return super.parseExprAtom(refDestructuringErrors);
		}

		jsjs_parseJSJSStatement () {
			this.expect(tt_jsjsStatementOpen);
			const val = this.parseStatement();
			this.expect(tt_jsjsClose);
			return val;
		}

		jsjs_parseJSJSExpression () {
			this.expect(tt_jsjsExprOpen);
			const val = this.parseExpression();
			this.expect(acorn.tokTypes.braceR);
			return val;
		}

		toAssignable (node) {
			if (node.type === 'JSJSTemplateElement') return node;
			return super.toAssignable.apply(this, arguments);
		}

		checkLVal (expr) {
			if (expr.type === 'JSJSTemplateElement') return;
			super.checkLVal.apply(this, arguments);
		}
	};
};

const ext = Parser => {
	return () => plugin(Parser);
};

module.exports = {parser: Parser.extend(ext(Parser)), ext: ext};
