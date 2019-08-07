// Some blocks cause the runtime to "yield" until the next frame,
// but only when the sprite causes a visual change.
// These include "repeat" blocks, which run their contents once per frame
// if they change something on-screen, but run them all at once if they don't.

// Whether or not a block causes a visual change is tracked in the runtime
// via the "VISUAL" flag. Some blocks cause a visual change when the sprite is
// showing, some also cause a visual change if the sprite's pen is down,
// and some cause a visual change no matter what.

// These blocks are divided up into the categories below,
// then they are tallied up into the visibilityBlockScopes map,
// where block opcodes are mapped to the scope of
// exactly how often they cause a visibility change.
// (e.g. "motion_movesteps":AFFECTS_VISUAL_FOR_VISIBLE_OR_PEN_DOWN,
// "looks_show":AFFECTS_VISUAL_ALWAYS)

const VisibilityScope = Object.freeze({
	DOES_NOT_AFFECT_VISUAL: 0,
	AFFECTS_VISUAL_FOR_VISIBLE_ONLY: 1,
	AFFECTS_VISUAL_FOR_VISIBLE_OR_PEN_DOWN: 2,
	AFFECTS_VISUAL_ALWAYS: 3
});

const visibilityBlockScopeCategories = {};

visibilityBlockScopeCategories[VisibilityScope.AFFECTS_VISUAL_FOR_VISIBLE_ONLY] = [
	'motion_turnright',
	'motion_turnleft',
	'motion_pointindirection',
	'motion_pointtowards',
	'motion_setrotationstyle',
	'looks_switchcostumeto',
	'looks_nextcostume',
	'looks_say',
	'looks_sayforsecs',
	'looks_think',
	'looks_thinkforsecs',
	'looks_changeeffectby',
	'looks_seteffectto',
	'looks_cleargraphiceffects',
	'looks_changesizeby',
	'looks_setsizeto',
	'looks_gotofrontback',
	'looks_goforwardbackwardlayers'
];

visibilityBlockScopeCategories[VisibilityScope.AFFECTS_VISUAL_FOR_VISIBLE_OR_PEN_DOWN] = [
	'motion_movesteps',
	'motion_gotoxy',
	'motion_goto_menu',
	'motion_glidesecstoxy',
	'motion_changexby',
	'motion_setx',
	'motion_changeyby',
	'motion_sety',
	'motion_ifonedgebounce'
];

visibilityBlockScopeCategories[VisibilityScope.AFFECTS_VISUAL_ALWAYS] = [
	'looks_show',
	'looks_hide',
	'looks_switchbackdropto',
	'looks_switchbackdroptoandwait',
	'looks_nextbackdrop',
	'pen_clear',
	'pen_stamp',
	'pen_penDown',
	'pen_penUp',
	'data_showvariable',
	'data_hidevariable',
	'data_showlist',
	'data_hidelist',
	'sensing_askandwait',
	'sound_changevolumeby',
	'sound_setvolumeto',
	'music_changeTempo',
	'music_setTempo'
];

const visibilityBlockScopes = {};

Object.entries(visibilityBlockScopeCategories).forEach(entry => {
	entry[1].forEach(opcode => {
		visibilityBlockScopes[opcode] = parseInt(entry[0]);
	});
});

module.exports = {VisibilityScope, visibilityBlockScopes};
