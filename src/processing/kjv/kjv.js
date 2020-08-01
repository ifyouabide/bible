import fs from 'fs';
import path from 'path';
import xmldoc from 'xmldoc';

import {writeBibleFilesSync, writeMapFilesSync} from '../utils.js';
import * as bibles from '../../common/bibles.js';
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

function toVerse2(ref, contents) {
	let nodes = new xmldoc.XmlDocument('<root>' + contents + '</root>').children.slice(1);
	let text = '';
	let origTokens = {};
	let map = [];

	function process(node) {
		if (node.name == 'note') return;
		if (node.name == 'title' && ref.chAndVerse.startsWith('119')) return;

		let tkiStart = -1;
		let origTkis = [];
		// There are 4 places in Ezra without a lemma, not sure why.
		if (node.name == 'w' && node.attr && node.attr.lemma) {
			let strongs = node.attr.lemma.split(' ')
				.filter(p => p.startsWith('strong:'))
				.map(p => p.split(':')[1])
				.map(p => p[0] + parseInt(p.slice(1)));

			let words = node.attr.lemma.split(' ')
				.filter(p => p.startsWith('lemma.TR:'))
				.map(p => p.split(':')[1]);
			if (words.length && words.length != strongs.length) {
				if (ref.book + ref.chAndVerse == '1co15:35') {
					strongs = ['G3498'];
				} else if (ref.book + ref.chAndVerse == '2co8:10') {
					strongs.push('G3778');
				} else {
					throw new Error('mismatch between strong and word count ' + ref.book + ref.chAndVerse + ' ' + strongs + '!=' + words);
				}
			}

			let morphs = [];
			if (node.attr.morph) {
				morphs = node.attr.morph.split(' ')
					.map(p => Object.fromEntries([p.split(':')]));
				if (morphs.length != strongs.length) {
					morphs = [];
					//console.log('strong/morph mismatch', node.attr.lemma, node.attr.morph);
				}
			}

			if (node.attr.src) {
				origTkis = node.attr.src.trim().split(' ').map(p => parseInt(p) - 1);
				if (origTkis.length != strongs.length) {
					throw new Error('mismatch between strong and srcs count ' + ref.book + ref.chAndVerse + ' ' + strongs + '!=' + origTkis);
				}
			} else {
				origTkis = strongs.map((_, i) => Object.keys(origTokens).length + i);
			}
			for (let i in origTkis) {
				let tuple = morphs[i] || {};
				tuple['strong'] = strongs[i];
				if (words[i]) tuple['word'] = words[i];
				origTokens[origTkis[i]] = tuple;
			}
			tkiStart = bibles.getTokenCount(text);
		}

		if (node.text) {
			text += node.text;
		} else if (node.name == 'divineName' && node.children.length == 1) {
			text += node.firstChild.text.toUpperCase();
		} else {
			//node.name == 'inscription' || node.name == 'title' || node.name == 'q'
			if (!node.children) throw new Error('unrecognized node' + node);

			node.children.forEach(process);
		}

		if (tkiStart != -1) {
			let tokens = bibles.textToTokens(text);
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

	text = text.trim() + (endOfUnit ? '' : ' ');

	function rebase(origTokens, map) {
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
	}
	origTokens = Object.entries(origTokens).sort((a, b) => a[0] - b[0]);
	rebase(origTokens, map);
	return {
		eng: text,
		orig: origTokens.map(([i, tk]) => tk),
		map: map,
	};
}

function toVerse(contents) {
	let ref = parseRef(contents);
	if (ref.chAndVerse.endsWith(':0')) return [];

	const endTitle = '</title>';
	let titleEnd = contents.indexOf(endTitle);
	let obj = {};
	if (titleEnd != -1) {
		if (!ref.chAndVerse.startsWith('119')) {
			obj[ref.chAndVerse.split(':')[0] + ':0'] = toVerse2(ref, contents.slice(0, titleEnd + endTitle.length));
			contents = contents.slice(titleEnd + endTitle.length);
		}
	}
	obj[ref.chAndVerse] = toVerse2(ref, contents);
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
let namedBibles = bibles.verse.unmergeNamed(toBible(contents));
writeBibleFilesSync('kjv', namedBibles.eng);
writeBibleFilesSync('tr', namedBibles.orig);
writeMapFilesSync(namedBibles.map, 'kjv', namedBibles.eng, 'tr', namedBibles.orig);