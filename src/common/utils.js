export function $id(id) {
	return document.getElementById(id);
}

export function exportDebug(name, value) {
	setIfUnset(window, 'dbg', {})[name] = value;
}

export function setIfUnset(o, key, initialValue) {
	if (!o.hasOwnProperty(key)) {
		o[key] = initialValue;
	}
	if (o[key] instanceof Object) {
		return o[key];
	}
	return o;
}

let g_debug = new URLSearchParams(window.location.search).has('debug');

export function setDebugEnabled(enabled) {
	g_debug = enabled;
}

export function ifDebug(fn) {
	if (g_debug) fn();
}

export const onLoad = new Promise(ok => {
	if (document.readyState === 'interactive' || document.readyState === 'complete') {
		ok();
	} else {
		window.addEventListener('DOMContentLoaded', ok);
	}
});

export function makeElem(str, wrapTag = undefined) {
	let parent = document.createElement(wrapTag ? wrapTag : 'div');
	parent.innerHTML = str;
	if (wrapTag) return parent;
	return parent.firstElementChild;
}

export class Timer {
	constructor() {
		this.reset();
	}
	elapsed() {
		return performance.now() - this.t;
	}
	reset() {
		this.t = performance.now();
	}
	mark() {
		let e = this.elapsed();
		this.reset();
		return e.toFixed(0) + 'ms';
	}
}

export const client = (() => {
	let isDesktop = navigator.userAgent.search(/iPad|iPhone|iPod|android|webOS/i) == -1;
	let isSmallScreen = screen.width < 700 || screen.height < 700;
	return {
		isDesktop: isDesktop,
		isSmallScreen: isSmallScreen,
	};
})();