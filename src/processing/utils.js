import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

import * as bibles from '../common/bibles.js';

let g_resourcesDir = path.join('build', 'resources');

export function writeBibleFilesSync(bibleName, verseBible) {
	fs.mkdirSync(g_resourcesDir, {recursive: true});

	let suffix = (bibles.getFormat(verseBible) == bibles.format.verseText) ? 'text' : 'token';
	fs.writeFileSync(
		path.join(g_resourcesDir, `${bibleName}_verse_${suffix}.json`),
		JSON.stringify(verseBible, null, '\t'),
		'utf8');

	let contents = JSON.stringify(bibles.verse.toBookTokenBible(verseBible), null, '\t')
		.replace(/\n\t{3}"/g, '"')
		.replace(/\n\t{4}"/g, '"')
		.replace(/\n\t{3}\}/g, '}');
	fs.writeFileSync(path.join(g_resourcesDir, `${bibleName}_book_token.json.br`), compress(contents));
}

export function writeMapFilesSync(verseBibleMap, leftName, leftVerseBible, rightName, rightVerseBible, suffix = '') {
	fs.mkdirSync(g_resourcesDir, {recursive: true});

	fs.writeFileSync(
		path.join(
			g_resourcesDir,
			`map_${leftName}_to_${rightName}_verse_token${suffix ? '_' + suffix : ''}.json`),
		JSON.stringify(verseBibleMap, null, '\t')
			.replace(/\n\t{5}/g, '')
			.replace(/\n\t{4}/g, '')
			.replace(/\n\t{3}\]/g, ']'),
		'utf8');

	let contents = JSON.stringify(bibles.verse.toBookTokenMap(verseBibleMap, leftVerseBible, rightVerseBible), null, '\t')
		.replace(/\n\t{4}/g, '')
		.replace(/\n\t{3}/g, '')
		.replace(/\n\t{2}\]/g, ']');
	fs.writeFileSync(
		path.join(
			g_resourcesDir,
			`map_${leftName}_to_${rightName}_book_token${suffix ? '_' + suffix : ''}.json.br`),
		compress(contents));
}

export function compress(text, {quality} = {}) {
	if (quality === undefined) {
		quality = process.argv.indexOf('--fast-brotli') != -1
			? 4 : zlib.constants.BROTLI_MAX_QUALITY;
	}
	return zlib.brotliCompressSync(text, {
		params: {
			[zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
			[zlib.constants.BROTLI_PARAM_QUALITY]: quality,
		},
	});
}

export function setIfUnset(o, key, initialValue) {
	if (!o.hasOwnProperty(key)) {
		o[key] = initialValue;
	}
	if (o[key] instanceof Object) {
		return o[key];
	}
	return o;
}

export function getEditDistance(s1, s2, {prohibitSubstitution = false, identityFn = a => a} = {}) {
	return getMinimalEdits(
		s1, s2, {prohibitSubstitution: prohibitSubstitution, allowMoves: allowMoves, identityFn: identityFn}).length;
}

export function getMinimalEdits(s1, s2, {prohibitSubstitution = false, identityFn = a => a} = {}) {
	let matrix = Array.from(
		Array(s1.length + 1),
		() => Array.from(Array(s2.length + 1), () => 0));

	for (let i = 1; i <= s1.length; i++) {
		matrix[i][0] = i;
	}
	for (let j = 1; j <= s2.length; j++) {
		matrix[0][j] = j;
	}

	let substitutionCost = (prohibitSubstitution ? Infinity : 1);
	for (let j = 1; j <= s2.length; j++) {
		for (let i = 1; i <= s1.length; i++) {
			matrix[i][j] = Math.min(
				matrix[i-1][j] + 1, // deletion
				matrix[i][j-1] + 1, // insertion
				matrix[i-1][j-1] + (identityFn(s1[i-1]) == identityFn(s2[j-1]) ? 0 : substitutionCost) // substitution
			);
		}
	}

	let i = s1.length;
	let j = s2.length;
	let ops = [];
	while (i || j) {
		let diag = 1e10, left = 1e10, up = 1e10;
		if (i) left = matrix[i-1][j];
		if (j) up = matrix[i][j-1];
		if (i && j && (!prohibitSubstitution || matrix[i-1][j-1] == matrix[i][j]))
			diag = matrix[i-1][j-1];
		let min = Math.min(diag, left, up);
		if (left == min) {
			ops.push({delete: {e: s1[i-1], i: i-1}});
			i--;
		} else if (up == min) {
			ops.push({add: {e: s2[j-1], i: i}});
			j--;
		} else if (diag == min) {
			if (s1[i-1] != s2[j-1]) {
				ops.push({substitute: [{e: s1[i-1], i: i-1}, {e: s2[j-1], i: j-1}]});
			}
			i--;
			j--;
		}
	}
	return ops;
}