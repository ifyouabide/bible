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

export function compress(text) {
	let quality = process.argv.indexOf('--brotli-min-quality') != -1
		? zlib.constants.BROTLI_MIN_QUALITY : zlib.constants.BROTLI_MAX_QUALITY;
	return zlib.brotliCompressSync(text, {
		[zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
		[zlib.constants.BROTLI_PARAM_QUALITY]: quality,
	});
}