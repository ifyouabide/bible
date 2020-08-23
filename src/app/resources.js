import * as bibles from '../common/bibles.js';
import * as books from '../common/books.js';
import settings from '../common/settings.js';
import {exportDebug, client} from '../common/utils.js';

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

let loadPromises = [];

export let bible = {};
loadPromises.push(get(settings.bible + '_book_token.json').then(b => {
	bible = b;
	exportDebug('bible', bible);
}));

export let textToWidth = {};
loadPromises.push(get('layout.json').then(t => {
	textToWidth = t;
}));

export let onLoad = Promise.all(loadPromises);

export let onParserLoad = new Promise(fn => {
	let scriptElem = document.createElement('script');
	scriptElem.onload = fn;
	scriptElem.src = 'resources/en_bcv_parser.min.js';
	document.head.appendChild(scriptElem);
});

export let original = null;
export let bibleToOriginal = null;
export let strongs = null;
export let isOriginalLoaded = false;
export let onOriginalLoad = null;

let originalLoadPromises = [];
if (settings.original) {
	originalLoadPromises.push(get(settings.original + '_book_token.json').then(v => {
		original = v;
	}));

	originalLoadPromises.push(get(`map_${settings.bible}_to_${settings.original}_book_token.json`)
		.then(v => {
			bibleToOriginal = v;
		}));

	originalLoadPromises.push(get('strongs.json').then(v => {
		strongs = v;
	}));

	onOriginalLoad = Promise.all(originalLoadPromises).then(() => isOriginalLoaded = true);
}
