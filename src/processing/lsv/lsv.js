// Generates LSV-related resources in build/resources.

import fs from 'fs';
import path from 'path';

import * as books from '../../common/books.js';
import {writeBibleFilesSync} from '../utils.js';

const PSALMS_WITH_PRESCRIPTS = [
	3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
	22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 34, 35, 36, 37, 38,
	39, 40, 41, 42, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55,
	56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 72,
	73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88,
	89, 90, 92, 98, 100, 101, 102, 103, 108, 109, 110, 120, 121, 122,
	123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 138,
	139, 140, 141, 142, 143, 144, 145
];

function toVerses(text, bk, ch) {
	text = text.replace(/  +/g, ' ');
	text = ' ' + text.trim().split('\n').join('');

	let vs = [];
	let start = 0;
	let missing = [];
	let consec_missing = 0;
	for (let v = 1; v < 200; v++) {
		let v_sub = ` ${v} `;
		let found = text.indexOf(v_sub, start);
		if (found != -1) {
			if (found - start > 800) {
				throw new Error(`Failed to find verse: ${bk}${ch}:${v_sub}`);
			}
			start = found + v_sub.length;
			vs.push([v, found, start]);
			consec_missing = 0;
		} else {
			missing.push(`${bk}${ch}:${v_sub.trim()}`);
			consec_missing++;
		}
		if (consec_missing > 10) {
			missing = missing.slice(0, missing.length - 11);
			break;
		}
	}
	if (missing.length) {
		console.log('missing', missing.join('\nmissing '));
	}

	let vs2 = [];
	for (let i = 1; i < vs.length + 1; i++) {
		let end = (i < vs.length) ? vs[i][1] : 10000000;
		let content = text.slice(vs[i-1][2], end);
		if (!content.endsWith('—') && !content.endsWith('[') && i != vs.length) {
			content += ' ';
		}
		if (bk == 'ps' && vs[i-1][0] == 1) {
			if (PSALMS_WITH_PRESCRIPTS.indexOf(ch) != -1) {
				let sentences = content.split('||', 1)[0].split('.');
				for (let si = 0; si < sentences.length; si++) {
					if (sentences[si].match('[a-z]')) {
						let prescript = sentences.slice(0, si).join('.') + '. ';
						content = content.slice(prescript.length);
						vs2.push(['0', prescript]);
						break;
					}
					if (si == sentences.length - 1)
						throw new Error('Failed to make ps title: ' + ch);
				}
			}
		}

		vs2.push(['' + vs[i-1][0], content]);
	}
	return vs2;
}

function toBook(code, contents) {
	let chs = contents.split('CHAPTER ').slice(1);
	let out = {};
	for (let ch of chs) {
		let chNum = parseInt(ch.split('\n', 1)[0]);
		let chapterContents = ch.split('\n').slice(1).join('\n');
		let vs = toVerses(chapterContents, code, chNum)
		for (let v of vs) {
			out[chNum+':'+v[0]] = v[1];
		}
	}
	return [code, out];
}

function toBible(contents) {
	return Object.fromEntries(contents.split('=====')
		.map((b, i) => toBook(books.codes[i], b.slice(b.indexOf('\n') + 1))));
}

let contents = fs.readFileSync(path.join('third_party', 'lsv', 'lsv.txt'), 'utf8');
writeBibleFilesSync('lsv', toBible(contents));