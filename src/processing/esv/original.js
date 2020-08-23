import fs from 'fs';
import path from 'path';
import * as books from '../../common/books.js';
import {writeBibleFilesSync} from '../utils.js';

function toBible(ttesv, updates) {
	let lines = ttesv.split('========================================================================', 2)[1].trim().split('\n');

	function update(update) {
		let keyToUpdate = Object.fromEntries(
			update.split('# $START')[1].trim().split('\n')
				.map(line => [line.split('\t', 1)[0], line]));

		for (let i = 0; i < lines.length; i++) {
			let key = lines[i].split('\t', 1)[0];
			if (key in keyToUpdate) {
				lines[i] = keyToUpdate[key];
				delete keyToUpdate[key];
			}
		}

		if (Object.keys(keyToUpdate) != 0) {
			throw new Error('update with unknown ref: ' + Object.keys(keyToUpdate));
		}
	}
	updates.forEach(update);

	let bookIndexToLines = [];
	let bookLines;
	let lastBook;

	for (let l of lines) {
		let [book, verseAndTags] = l.split(' ', 2);
		if (book != lastBook) {
			if (bookLines) bookIndexToLines.push(bookLines);
			bookLines = [];
			lastBook = book;
		}
		bookLines.push(verseAndTags);
	}
	bookIndexToLines.push(bookLines);

	return Object.fromEntries(bookIndexToLines.map((lines, i) => toBook(books.codes[i], lines)));
}

function toBook(code, lines) {
	let verses = Object.fromEntries(lines.map(line => toVerse(code, line)));
	return [code, verses];
}

function fromOrig(o, nt) {
	// <12091> or <12091+19820> or <12091>+<19820> or <1902892>
	return o.split('+').map(p => {
		return {'strong': (nt ? 'G' : 'H') + parseInt(p.replace(/<|>/g, ''))};
	});
}

function toVerse(bkCode, line) {
	let nt = books.nt.has(bkCode);

	let entries = line.trim().split('\t').slice(1);
	let tokens = [];
	for (let entry of entries) {
		let esvToOriginal = entry.trim().split('=')
		if (esvToOriginal.length == 1) {
			if (esvToOriginal[0][0] == '<')
				tokens.push(...fromOrig(esvToOriginal[0], nt));
			else
				throw new Error('Unknown entry: ' + esvToOriginal);
		} else {
			tokens.push(...fromOrig(esvToOriginal[1], nt));
		}
	}

	let chapterAndVerse = line.split('\t', 1);
	return [
		chapterAndVerse,
		tokens,
	];
}

let ttesv = fs.readFileSync('third_party/stepbible/TTESV.txt', 'utf8');
let updates = [
	fs.readFileSync('src/processing/esv/ttesv_esv2016_changes.txt', 'utf8'),
	fs.readFileSync('src/processing/esv/ttesv_misc_changes.txt', 'utf8'),
];
let bible = toBible(ttesv, updates);
writeBibleFilesSync('oesv', bible);