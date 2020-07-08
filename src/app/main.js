import * as bible_ui from './bible_ui.js';
import * as bible_utils from './bible_utils.js';
import * as resources from './resources.js';
import {$id, exportDebug} from './utils.js';

function addHistory(ref, opt_psg) {
	let newUrl = window.location.protocol + '//' + window.location.host + window.location.pathname + '?ref=' + ref;
	if (opt_psg) {
		newUrl += '&psg=' + opt_psg;
	}
	if (newUrl != document.URL) {
		window.history.pushState({path: newUrl}, '', newUrl);
	}
}

function getCurrentRef() {
	let refs = g_bookElem.querySelectorAll('.vnum');
	let line = g_bookElem.scrollTop + $id('readLine').offsetTop;
	for (let i = 0; i < refs.length; i++) {
		if (refs[i].offsetTop > line) {
			return refs[i == 0 ? 0 : i-1].id;
		}
	}
	if (refs.length == 0) {
		return null;
	}
	return refs[refs.length - 1].id;
}

function read(refStr) {
	let ref = bible_utils.Ref.parse(refStr);
	if (!ref) return false;
	ref.snapToExisting();

	return g_bookElem.show(bible_utils.RefRange.parse(ref.book), {scrollTo: ref});
}

let g_bookElem;
exportDebug('bible_utils', bible_utils);

function main() {
	g_bookElem = bible_ui.createElement({id: 'book'});
	$id('readPanel').appendChild(g_bookElem);
	resources.startingBookPromise.then(() => read(resources.startingRef));
}

if (document.readyState === 'interactive' || document.readyState === 'complete') {
	main();
} else {
	window.addEventListener('DOMContentLoaded', main);
}