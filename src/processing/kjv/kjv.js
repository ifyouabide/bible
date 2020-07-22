import fs from 'fs';
import path from 'path';
import xmldoc from 'xmldoc';

import {writeBibleFilesSync} from '../utils.js';
import * as books from '../../common/books.js';

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

	function process(node, {inTitle = false} = {}) {
		function addText(t) {
			if (inTitle)
				title += t;
			else
				text += t;
		}

		if (node.name == 'note') return;

		if (node.text) {
			addText(node.text);
			return;
		}

		if (node.name == 'divineName' && node.children.length == 1) {
			addText(node.firstChild.text.toUpperCase());
			return;
		}
		
		//node.name == 'inscription' || node.name == 'title' || node.name == 'q'
		if (!node.children) throw new Error('unrecognized node' + node);

		let nextInTitle = inTitle || node.name == 'title';

		node.children.forEach(n => process(n, {inTitle: nextInTitle}));
	}

	for (let node of nodes) {
		process(node);
	}

	let endOfUnit = contents.indexOf('<div canonical="true"') != -1
		|| (contents.indexOf('<chapter ') != -1 && ref.book == 'ps');

	text = text.trim() + (endOfUnit ? '' : ' ');

	let obj = {};
	if (title.length)
		obj[ref.chAndVerse.split(':')[0] + ':0'] = title;
	obj[ref.chAndVerse] = text;	
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
writeBibleFilesSync('kjv', toBible(contents));