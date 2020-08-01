import fs from 'fs';
import {compress} from '../utils.js';

function entryFromColumns(l, keyColumn, nameToColumn) {
	let columns = l.split('\t');
	return [
		columns[keyColumn],
		Object.fromEntries(Object.entries(nameToColumn).map(([k, col]) => [k, columns[col]])),
	];
}

let hebrew = fs.readFileSync('third_party/stepbible/TBESH.txt', 'utf8');
hebrew = 'H0001' + hebrew.split('\nH0001', 2)[1];
hebrew = Object.fromEntries(
	hebrew
		.split('\n')
		.map(l => entryFromColumns(l, 0, {lemma: 1, transliteration: 2}))
		.filter(e => isLessThan(e[0], 9000)));

let greek = fs.readFileSync('third_party/stepbible/TBESG.txt', 'utf8');
greek = 'G0001' + greek.split('\nG0001', 2)[1];
greek = Object.fromEntries(
	greek
		.split('\n')
		.map(l => entryFromColumns(l, 0, {lemma: 2, transliteration: 3}))
		.filter(e => isLessThan(e[0], 6000)));

function isLessThan(s, max) {
	return parseInt(s.slice(1)) < max;
}

let strongs = Object.fromEntries(
	Object.entries(hebrew).concat(Object.entries(greek))
		.map(e => [e[0].replace(/^(.)0+/, '$1'), e[1]]));
let contents = JSON.stringify(strongs, null, '\n').replace(/\n\n+/g, '\n');
fs.writeFileSync(
	'build/resources/strongs.json.br',
	compress(contents),
	'utf8');