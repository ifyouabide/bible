import * as books from '../common/books.js';
import * as formats from '../common/formats.js';
import {exportDebug, client} from './utils.js';

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
		ref = client.isFullVersion ? 'jn8:31' : 'jn1:1';
	}
	return ref;
})();

export const startingBookPromise = (() => {
	let code = books.codes.filter(k => startingRef.startsWith(k))[0];
	return get(`lsv_${code}.json`)
		.then(bk => {
			let startingBook = formats.VerseTextToTokenConverter.convertBook(code, bk);
			bible[code] = startingBook;
			return startingBook;
		});
})();

export let bible = {};
get('lsv.json').then(b => {
	bible = formats.VerseTextToTokenConverter.convertBible(b);
	exportDebug('bible', bible);
});