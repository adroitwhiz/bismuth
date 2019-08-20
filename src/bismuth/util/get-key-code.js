// Translate a Scratch keyboard key dropdown value into a numeric key code.

const KEY_CODES = {
	space: 32,
	'left arrow': 37,
	'up arrow': 38,
	'right arrow': 39,
	'down arrow': 40,
	any: 'any'
};

const getKeyCode = keyName => KEY_CODES[keyName.toLowerCase()] || keyName.toUpperCase().charCodeAt(0);

module.exports = getKeyCode;
