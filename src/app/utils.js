export function $id(id) {
	return document.getElementById(id);
}

export function exportDebug(name, value) {
	setIfUnset(window, 'dbg', {})[name] = value;
}

export function setIfUnset(o, key, initialValue) {
	if (!(key in o)) {
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

export function onLoad() {
	return new Promise(ok => {
		if (document.readyState === 'interactive' || document.readyState === 'complete') {
			ok();
		} else {
			window.addEventListener('DOMContentLoaded', ok);
		}
	});
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
	// Both iPad (safari) and moto e5 play (chrome) innerWidth of 980 and devicePixelRatio of 2.
	// TODO: consider using visualViewport.scale (.367 on moto e5 play).
	let isFullVersion = isDesktop || (window.innerWidth / window.devicePixelRatio > 900);
	return {
		isDesktop: isDesktop,
		isFullVersion: isFullVersion,
	};
})();