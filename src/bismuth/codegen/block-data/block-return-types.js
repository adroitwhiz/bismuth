// Some reporter blocks are known to return certain types (e.g. math blocks always return numbers).
// To avoid redundant type coercions, we can "type tag" the generated JS for those blocks,
// so the compiler knows that they are already of the proper type.
// This is a map of return types for reporter blocks.
// Valid return types are string, number, and boolean.
const BLOCK_RETURN_TYPES = new Map([
	['motion_xposition', 'number'],
	['motion_yposition', 'number'],
	['motion_direction', 'number'],
	['looks_size', 'number'],
	['sound_volume', 'number'],
	['sensing_touchingobject', 'boolean'],
	['sensing_touchingcolor', 'boolean'],
	['sensing_coloristouchingcolor', 'boolean'],
	['sensing_distanceto', 'number'],
	['sensing_answer', 'string'],
	['sensing_keypressed', 'boolean'],
	['sensing_mousedown', 'boolean'],
	['sensing_mousex', 'number'],
	['sensing_mousey', 'number'],
	['sensing_loudness', 'number'],
	['sensing_timer', 'number'],
	['sensing_current', 'number'],
	['sensing_dayssince2000', 'number'],
	['sensing_username', 'string'],
	['operator_add', 'number'],
	['operator_subtract', 'number'],
	['operator_multiply', 'number'],
	['operator_divide', 'number'],
	['operator_random', 'number'],
	['operator_lt', 'boolean'],
	['operator_equals', 'boolean'],
	['operator_gt', 'boolean'],
	['operator_and', 'boolean'],
	['operator_or', 'boolean'],
	['operator_not', 'boolean'],
	['operator_join', 'string'],
	['operator_letter_of', 'string'],
	['operator_length', 'number'],
	['operator_mod', 'number'],
	['operator_round', 'number'],
	['operator_mathop', 'number'],
	['data_listcontents', 'string'],
	['data_lengthoflist', 'number'],
	['data_listcontainsitem', 'boolean']
]);

module.exports = BLOCK_RETURN_TYPES;
