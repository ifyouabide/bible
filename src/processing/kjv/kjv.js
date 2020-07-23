import fs from 'fs';
import path from 'path';
import xmldoc from 'xmldoc';

import {writeBibleFilesSync} from '../utils.js';
import * as books from '../../common/books.js';
import * as formats from '../../common/formats.js';

let nameToCode = Object.assign({}, ...Object.entries(books.codeToName).map(([a,b]) => ({[b.replace('3', 'III').replace('2', 'II').replace('1', 'I')]: a})));
nameToCode['Song of Solomon'] = 'so';
nameToCode['Revelation of John'] = 're';

function parseRef(entry) {
	let str = entry.split('<key>', 2)[1].split('</key>', 1)[0];

	let index = str.search(/\d+:\d+$/);
	if (index == -1) {
		throw new Error(`bad ref: ${str}`);
	}
	let bk = str.slice(0, index - 1);
	if (!(bk in nameToCode)) {
		throw new Error(`${bk} not a known book`);
	}
	let code = nameToCode[bk];
	return {
		book: code,
		chAndVerse: str.slice(index),
	}
}

function toVerse(contents) {
	let ref = parseRef(contents);
	if (ref.chAndVerse.endsWith(':0')) return [];

	let nodes = new xmldoc.XmlDocument('<root>' + contents + '</root>').children.slice(1);
	let title = '';
	let text = '';
	let origTokens = {};
	let map = [];

	function process(node, {inTitle = false} = {}) {
		function addText(t) {
			if (inTitle)
				title += t;
			else
				text += t;
		}

		if (node.name == 'note') return;

		let tkiStart = -1;
		let origTkis = [];
		// There are 4 places in Ezra without a lemma, not sure why.
		if (!inTitle && node.name == 'w' && node.attr && node.attr.lemma) {
			let strongs = node.attr.lemma.split(' ')
				.filter(p => p.startsWith('strong:'))
				.map(p => p.split(':')[1])
				.map(p => p[0] + parseInt(p.slice(1)));
			if (node.attr.src) {
				origTkis = node.attr.src.split(' ')
					.map(p => parseInt(p) - 1);
			} else {
				origTkis = strongs.map((_, i) => Object.keys(origTokens).length + i);
			}
			strongs.forEach((s, i) => origTokens[origTkis[i]] = s);
			tkiStart = formats.VerseTextToTokenConverter.convertText(text).length;
		}

		if (node.text) {
			addText(node.text);
		} else if (node.name == 'divineName' && node.children.length == 1) {
			addText(node.firstChild.text.toUpperCase());
		} else {
			//node.name == 'inscription' || node.name == 'title' || node.name == 'q'
			if (!node.children) throw new Error('unrecognized node' + node);

			let nextInTitle = inTitle || node.name == 'title';

			node.children.forEach(n => process(n, {inTitle: nextInTitle}));
		}

		if (tkiStart != -1) {
			let tokens = formats.VerseTextToTokenConverter.convertText(text);
			let engTkis = [];
			for (let tki = tkiStart; tki < tokens.length; tki++) {
				if ('word' in tokens[tki]) {
					engTkis.push(tki);
				}
			}
			map.push([engTkis, origTkis]);
		}
	}

	for (let node of nodes) {
		process(node);
	}

	let endOfUnit = contents.indexOf('<div canonical="true"') != -1
		|| (contents.indexOf('<chapter ') != -1 && ref.book == 'ps');

	text = text.trimRight() + (endOfUnit ? '' : ' ');

	origTokens = Object.entries(origTokens).sort((a, b) => a[0] - b[0]);
	let i = 0;
	for (let [tki, tk] of origTokens) {
		if (tki != i) {
			for (let [engSet, origSet] of map) {
				for (let oi = 0; oi < origSet.length; oi++) {
					if (origSet[oi] == tki) {
						origSet[oi] = i;
						origTokens[i][0] = i;
					}
				}
			}
		}
		i++;
	}

	origTokens = origTokens.map(t => t[1]);

	function stringifyMap(m) {
		return map.map(([e, o]) => e.join(',') + '=' + o.join(',')).join(' ');
	}

	let obj = {};
	if (title.length) {
		obj[ref.chAndVerse.split(':')[0] + ':0'] = {eng: title};
	}

	obj[ref.chAndVerse] = {eng: text, orig: origTokens, map: stringifyMap(map)};
	return obj;
}

function toBook(contents) {
	let verseContents = contents.split('\n').slice(2, -1);
	let verses = verseContents.map(toVerse).flat();

	return [parseRef(verseContents[0]).book, Object.fromEntries(verses.map(o => Object.entries(o)).flat())];
}

function toBible(contents) {
	contents = contents.replace('<key>[ Testament 2 Heading ]</key><milestone type="x-importer" subType="x-osis2mod" n="$Rev: 3322 $"/>\n', '');
	let bookDelimiter = '<div canonical="true" osisID="';
	let bookContents = contents.split(bookDelimiter).slice(1).map(p => bookDelimiter + p);
	return Object.fromEntries(bookContents.map(toBook));
}

let contents = fs.readFileSync(path.join('third_party', 'kjv', 'entries.txt'), 'utf8');
let combinedBible = toBible(contents);
writeBibleFilesSync(
	'kjv',
	Object.fromEntries(
		Object.entries(combinedBible)
			.map(([code, bk]) =>
				[
					code,
					Object.fromEntries(
						Object.entries(bk)
							.map(([ref, v]) => [ref, v.eng]))
				])));
writeBibleFilesSync(
	'kjv_to_orig',
	Object.fromEntries(
		Object.entries(combinedBible)
			.map(([code, bk]) =>
				[
					code,
					Object.fromEntries(
						Object.entries(bk)
							.filter(([ref, v]) => 'map' in v)
							.map(([ref, v]) => [ref, {text: v.orig, map: v.map}]))
				])));