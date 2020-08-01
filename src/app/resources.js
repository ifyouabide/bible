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

/*
function mergeMap() {
	for (let bkCode of bible) {
		bible[bkCode].map = map[bkCode];
	}
}*/

let loadPromises = [];

export let bible = {};
loadPromises.push(get(settings.bible + '_book_token.json').then(b => {
	bible = b;
	//if (map) mergeMap();
	exportDebug('bible', bible);
}));

export let textToWidth = {};
loadPromises.push(get('layout.json').then(t => {
	textToWidth = t;
}));

/*
export let strongs = {};
loadPromises.push(get('strongs.json').then(s => {
	strongs = s;
}));

export let map = {};
loadPromises.push(get('map_lsv_to_tr_book_token.json').then(v => {
	map = v;
	if (bible) mergeMap();
}));
*/

export let onLoad = Promise.all(loadPromises);