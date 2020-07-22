import * as books from '../common/books.js';
import * as formats from '../common/formats.js';
import {exportDebug, client} from '../common/utils.js';
import settings from './settings.js';

let g_resources = {};

export function get(name) {
	if (name in g_resources) {
		return g_resources[name];
	}
	let promise = fetch('resources/' + name)
		.then(response => response.json())
	g_resources[name] = promise;
	return promise;
}

export const startingRef = (() => {
	let params = new URLSearchParams(window.location.search);
	let ref = params.get('ref');
	if (!ref || !books.codes.some(k => ref.startsWith(k))) {
		return;
	}
	return ref;
})();

export const startingBookPromise = (() => {
	if (!startingRef) return;

	let bkCode = books.codes.filter(k => startingRef.startsWith(k))[0];
	return get(`${settings.bible}_${bkCode}.json`)
		.then(bk => {
			let startingBook = formats.VerseTextToTokenConverter.convertBook(bkCode, bk);
			bible[bkCode] = startingBook;
			return startingBook;
		});
})();

export let bible = {};
get(settings.bible + '.json').then(b => {
	bible = formats.VerseTextToTokenConverter.convertBible(b);
	exportDebug('bible', bible);
});