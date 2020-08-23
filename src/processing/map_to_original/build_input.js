import * as bibles from '../../common/bibles.js';
import * as refs from '../../common/refs.js';
import fs from 'fs';
import * as mapToOriginal from './map_to_original.js';
import path from 'path';
import {compress, getMinimalEdits, setIfUnset} from '../utils.js';

function isWord(tk) {
	return 'word' in tk || 'strong' in tk;
}

function addMissingTokens(tks1, tks2) {
	let oldCounts = {};
	tks1.forEach(tk => setIfUnset(oldCounts, tk['strong'], 0)[tk['strong']]++);
	let newCounts = {};
	tks2.forEach(tk => setIfUnset(newCounts, tk['strong'], 0)[tk['strong']]++);
	for (let [strong, count] of Object.entries(newCounts)) {
		let additional = count - (oldCounts[strong] || 0);
		while (additional > 0) {
			tks1.push({'strong': strong, 'tki': tks1.length, 'wi': tks1.length});
			additional--;
		}
	}
}

function getTokensWithIndices(textOrTokens, excludeNoOriginal = false) {
	let tks = bibles.getTokens(textOrTokens, {modifiable: true});

	if (excludeNoOriginal) {
		let noOriginal = false;
		for (let tki = 0; tki < tks.length; tki++) {
			if (tks[tki]['punctuation'] == '[') {
				if (tks[tki+1] && tks[tki+1]['punctuation'] == '[') {
					tki++;
				} else {
					noOriginal = true;
				}
				continue;
			}
			if (tks[tki]['punctuation'] == ']') {
				if (tks[tki+1] && tks[tki+1]['punctuation'] == ']') {
					tki++;
				} else {
					noOriginal = false;
				}
				continue;
			}

			if (noOriginal) tks[tki]['noOriginal'] = true;
		}
	}
	tks.forEach((tk, i) => tk['tki'] = i);
	tks.filter(tk => isWord(tk) && !tk['noOriginal']).forEach((tk, wi) => tk['wi'] = wi);
	return tks;
}

function addSimilarVerse(originalWordTranslationMap, v, sv, similarName) {
	let originalTks = getTokensWithIndices(sv['original']);
	let similarOut = v['similar'][similarName] = {
		'originalTks': originalTks.filter(isWord),
	};
	if (!v['originalTks'].length) {
		v['originalTks'].push(...originalTks.filter(isWord));
	} else {
		addMissingTokens(v['originalTks'], originalTks.filter(isWord));
	}

	if (sv['map'] && sv['translation']) {
		let translationTks = getTokensWithIndices(sv['translation']);
		sv['map'].forEach(([transTkis, origTkis]) => {
			let strongs = origTkis.map(tki => originalTks[tki]['strong']);
			let translation = transTkis.map(tki => translationTks[tki]['word']).join(' ');
			mapToOriginal.addOriginalWordTranslation(
				originalWordTranslationMap, strongs, translation, similarName, {ref: v['ref']});
		});
		similarOut['translationTks'] = translationTks.filter(isWord);
		similarOut['map'] = sv['map'].map(([transTkis, origTkis]) => {
			return [
				transTkis.map(tki => translationTks[tki]['wi']),
				origTkis.map(tki => originalTks[tki]['wi']),
			];
		});
	}
}

function addSimilar(bible, originalWordTranslationMap, similarName, similarTuple) {
	let similarOriginalWordTranslationMap = similarTuple['originalWordTranslationMap'];
	if (similarOriginalWordTranslationMap) {
		delete similarTuple['originalWordTranslationMap'];
		for (let [strongsStr, translationToCount] of Object.entries(similarOriginalWordTranslationMap)) {
			let strongs = strongsStr.split(' ');
			let maxCount = Math.max(...Object.values(translationToCount));
			for (let [translation, count] of Object.entries(translationToCount)) {
				if (count > 1 && count > maxCount * .01) {
					mapToOriginal.addOriginalWordTranslation(
						originalWordTranslationMap, strongs, translation, similarName, {count: count});
				}
			}
		}
	}

	let similar = bibles.verse.mergeNamed(similarTuple);
	for (let bk in bible) {
		for (let [chapterAndVerse, v] of Object.entries(bible[bk])) {
			let sv = similar[bk][chapterAndVerse];
			if (!sv) continue;

			addSimilarVerse(originalWordTranslationMap, v, sv, similarName);
		}
	}
}

{
	let args = JSON.parse(process.argv[2]);

	let bible = bibles.verse.mergeNamed(
		{translation: JSON.parse(fs.readFileSync(args['translation'], 'utf8'))});
	for (let bk in bible) {
		for (let [chapterAndVerse, v] of Object.entries(bible[bk])) {
			v.ref = bk + chapterAndVerse;
			v.translationTks = getTokensWithIndices(v.translation, true).filter(tk => 'wi' in tk);
			v.map = [];
			v.originalTks = [];
			v.similar = {};
		}
	}

	let originalWordTranslationMap = {};

	for (let [name, tuple] of Object.entries(args['similar'])) {
		let similar = Object.fromEntries(
			Object.entries(tuple).map(([k, v]) => {
				return [k, JSON.parse(fs.readFileSync(v, 'utf8'))];
			}));
		addSimilar(bible, originalWordTranslationMap, name, similar);
	}

	let out = {};
	out['bible'] = Object.fromEntries(Object.entries(bible).filter((_, i) => i >= 39));
	out['originalWordTranslationMap'] = Object.fromEntries(Object.entries(originalWordTranslationMap).filter(([k, v]) => k[0] == 'G'));

	let outDir = 'build/intermediate';
	fs.mkdirSync(outDir, {recursive: true});
	fs.writeFileSync(
		path.join(outDir, `map_to_original_input_${args['name']}.json.br`),
		compress(JSON.stringify(out), {quality: 7}));
}