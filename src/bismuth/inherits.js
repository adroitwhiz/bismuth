var inherits = function(cla, sup) {
	cla.prototype = Object.create(sup.prototype);
	cla.parent = sup;
	cla.base = function(self, method /*, args... */) {
		return sup.prototype[method].call(self, [].slice.call(arguments, 2));
	};
};

module.exports = inherits;