// Some Scratch 2.0 project.json files aren't syntactically valid JSON and must be eval'd as JavaScript.
// TODO: reimplement Scratch 2.0's JSON parsing code from scratch since it's GPL-licensed :(
const parseJSONish = json => {
	if (!/^\s*\{/.test(json)) throw new SyntaxError('Bad JSON');
	try {
		return JSON.parse(json);
	} catch (e) {
		// let's play guess the regex
		if (/[^,:{}\[\]0-9\.\-+EINaefilnr-uy \n\r\t]/.test(json.replace(/"(\\.|[^"\\])*"/g, ''))) {
			throw new SyntaxError('Bad JSON');
		}
		return (1, eval)('(' + json + ')');
	}
};

module.exports = parseJSONish;
