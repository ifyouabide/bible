/**
 * @fileoverview Defines non-bundled JS APIs so we can closure compile still.
 * @externs
 */

//const bcv_parser = () => {};

let bcv_parser = class {
	constructor(){}

	set_options(obj) {}
	parse(str) {}
	osis() {}
};