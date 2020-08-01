import * as bibles from '../../common/bibles.js';
import * as refs from '../../common/refs.js';
import getEditDistance from './edit_distance.js';
import esvTranslations from './esv_translations.js';

/*
Map a bible translation to an original text using a similar translation that has such a mapping.
(currently only LSV -> TR using KJV -> TR)

Notes:
	- there is a distinction between mapping types (believe -> pistis) and mapping instances
	  (word #7 which happens to be faith -> word #3 which happens to be pistis).
	- in KJV OT, instance mapping isn't important since we don't have any order information.
	- it is less important to map all the words in the translation, just need to exhaust the orig
	  terms

Problems:
	- some orig terms don't have corresponding translation (e.g. ob1:1)
	- some verse boundaries are slightly different (e.g. ob1:9-10)

Questions:
	- We are dropping all the original that KJV mapping didn't contain. How bad is that?

Ideas:
	- Process in aggregate
	- Unique phrase matching (e.g. ob1:20 "and the", "of this"); a bit weak
	- Add more data:
		- Add alternates based on NAS translations
		- Add alternates based on Tyndale OT Hebrew/Greek Tagged
		- Add <rdg type="..."> tags
	- How many unique additions needed? just add em

Algorithm:
	At a high level, we are building up the map using various highly likely assumptions/rules,
	followed by a manual mapping of the leftovers.

	Prepare
		- per verse, build unmapped data consisting of lists of translation, similar, and original words
		- do some other work upfront

	Map using individual verse info
		- unique word/phrase matching (without and with alternatives)

	Map using aggregate info
		-(should this expand to nearby verses, to book, to whole?)
		-If just one leftover remaining, and there are 2+ cases where such, and no contradictions, map
		-If in all cases where leftover eng X is present, orig Y is also leftover and present, map
		-maybe verify other matches using aggregate as well, can one english word come from two different originals?

	Manual assisted
		-could add some points based on order, etc.
		-manually flag unknown combinations, uniquefy across OT or NT, and see how many we got
		-since LSV has small number of orig -> eng, maybe can provide a small list.
*/
export function mapUsingSimilarTranslation(translation, original, similar, similarToOriginal) {
	let merged = bibles.verse.mergeNamed(
		{translation: translation, original: original, similar: similar,
			similarMap: similarToOriginal});
	let verses = Object.entries(bibles.verse.flatten(merged))
		.map(([ref, v]) => Object.assign(v, {ref: ref}));

	verses.forEach(prepareVerse);
	let side = {
		groupTranslations: {},
		wordCounts: {},
	};
	verses.forEach(v => {
		populateGroupTranslations(side, v);
		populateWordCounts(side, v);
	});

	// Order descending:
	for (let [k, m] of Object.entries(side.groupTranslations)) {
		side.groupTranslations[k] = new Map(Array.from(m).sort((a, b) => b[1] - a[1]));
	}

	verses = verses.filter(v => new Set(['ob']).has(v.ref.slice(0, 2)));
	verses.forEach(v => processIndividually(side, v));
	verses.forEach(v => logProblems(side, v));

	// Prepare output:
	let out = {};
	for (let v of verses) {
		let ref = refs.parse(v.ref);
		if (!out[ref.book]) out[ref.book] = {};
		function toMap([translationTks, ogs]) {
			return [
				translationTks.map(tk => tk.tki),
				ogs.map(og => og.original.map(tk => tk.tki)).flat(),
			];
		}
		out[ref.book][ref.chapterAndVerse] = v.toOriginalGroups.map(toMap);
	}
	return out;
}

function prepareVerse(v) {
	// Build structure:
	let isWord = tk => 'word' in tk || 'strong' in tk;
	function getTokensWithIndices(textOrTokens) {
		let tks = bibles.getTokens(textOrTokens, {modifiable: true})
			.map((tk, i) => Object.assign(tk, {tki: i}));
		tks.filter(isWord).forEach((tk, i) => tk.wi = i);
		return tks;
	}
	let translationTokens = getTokensWithIndices(v.translation);
	let similarTokens = getTokensWithIndices(v.similar);
	let originalTokens = getTokensWithIndices(v.original);

	v.similarMap = v.similarMap
		.filter(([ts, os]) => ts.length && os.length)  // e.g. ge44:10, heb has no english
	v.originalGroups = v.similarMap
		.map(
			([ts, os], i) => { return {
				i: i,
				similar: ts.map(t => similarTokens[t]),
				original: os.map(o => originalTokens[o]),
			}});
	if (v.ref == 'ob1:3') {
		let x =100;
	}
	for (let og of v.originalGroups) {
		for (let s of og.similar) {
			s.originalGroup = og;
		}
	}

	// The wi of each token matches its index in these 3 lists.
	// In some cases where we remove words completely from consideration, the wi's are shifted.
	v.translation = translationTokens.filter(isWord);
	v.translationTkCount = translationTokens.length;
	v.similar = similarTokens.filter(isWord);
	v.original = originalTokens.filter(isWord);
	v.originalTkCount = originalTokens.length;
	
	function homogenizeCapitalization(w) {
		if (w.length == 1 || w.toUpperCase() != w) return w.toLowerCase();
		return w;
	}
	v.translation.forEach(tk => tk['word'] = homogenizeCapitalization(tk['word']));
	v.similar.forEach(tk => tk['word'] = homogenizeCapitalization(tk['word']));

	function homogenizeTetragrammaton(wtks, fn = undefined) {
		for (let wtki = 0; wtki < wtks.length; wtki++) {
			if (['GOD', 'LORD'].indexOf(wtks[wtki]['word']) != -1) {
				wtks[wtki]['word'] = 'YHWH';
				if (wtki > 0 && wtks[wtki-1]['word'] == 'the') {
					wtks.splice(wtki, 1);
					if (fn) fn(wtks[wtki-1]);
					wtki--;
				}
				for (let i = wtki; i < wtks.length; i++) {
					wtks[i].wi--;
				}
			}
		}
	}
	homogenizeTetragrammaton(v.translation);
	homogenizeTetragrammaton(v.similar, tkToDelete => {
		let ogi = 0;
		let tki = tkToDelete.tki;
		for (let [ts, os] of v.similarMap) {
			let found = ts.indexOf(tki);
			if (found != -1) {
				ts.splice(found, 1);
				v.originalGroups[ogi].similar.splice(found, 1);
			}
			ogi++;
		}
	});

	///// Done with edits /////

	v.unmapped = {
		translation: v.translation.concat(),
		similar: v.similar.filter(tk => tk.originalGroup),
	}
	v.toOriginalGroups = [];
}

function getOriginalGroupKey(og, onlyStrongs = false) {
	return og.original
		.map(tk => {
			let k = tk['strong'];
			if (!onlyStrongs)
				k += ';' + (tk['strongMorph'] || '') + ';' + (tk['robinson'] || '');
			return k;
		})
		.join(' ');
}

function incrementCounterMap(m, k) {
	m.set(k, (m.get(k) || 0) + 1);
}

function populateGroupTranslations(side, v) {
	for (let g of v.originalGroups) {
		for (let k of [getOriginalGroupKey(g), getOriginalGroupKey(g, true)]) {
			if (!side.groupTranslations[k]) side.groupTranslations[k] = new Map();
			let k2 = g.similar.map(tk => tk['word']).join(' ');
			incrementCounterMap(side.groupTranslations[k], k2);
		}
	}
}

function populateWordCounts(side, v) {
	for (let tk of v.similar) {
		if (!side.wordCounts[tk['word']]) side.wordCounts[tk['word']] = 0;
		side.wordCounts[tk['word']] += 1;
	}
}

function getWordCounts(list) {
	let m = new Map();
	list.map(tk => tk['word']).forEach(w => incrementCounterMap(m, w));
	return m;
}

function getReferencedOriginalGroups(list) {
	let groups = new Set();
	for (let tk of list) {
		groups.add(tk.originalGroup);
	}
	return Array.from(groups);
}

function removeIfMatchingOriginalGroup(list, originalGroup) {
	for (let i = 0; i < list.length; i++) {
		let obj = list[i];
		if (obj.originalGroup == originalGroup) {
			list.splice(i--, 1);
		}
	}
}

// TODO: Could compute this.
let MAY_HAVE_DIFFERENT_USES_IN_SINGLE_VERSE = new Set([
	'a',
	'an',
	'the',

	'be',
	'is',
	'are',
	'were',
	'was',

	'might',
	'could',	
	'would',
	'will',

	'has',
	'had',
	'have',

	'to',
]);
function isUnlikelyToHaveDifferentUsesInASingleVerse(w) {
	return !MAY_HAVE_DIFFERENT_USES_IN_SINGLE_VERSE.has(w);
}

function processIndividually(side, v) {
	mapUnique(side, v);
	mapUnique(side, v);
	mapUnique(side, v, {discardInsignificantWords: true});
	mapUniqueMergingOriginalGroups(side, v);
	mapUnique(side, v, {discardInsignificantWords: true, onlyStrongs: true});
	mapUnique(side, v, {looseMatch: true});
	mapUnique(side, v, {onlyStrongs: true, looseMatch: true});
	mapTrapped(side, v);
}

let INSIGNIFICANT_WORDS = new Set([
	'a',
	'an',
	'the',

	'be',
	'is',
	'are',
	'were',
	'was',

	'might',
	'could',	
	'would',
	'will',

	'has',
	'had',
	'have',

	'to',
]);
function mapUnique(
		side, v,
		{
			discardInsignificantWords = false,
			onlyStrongs = false,
			looseMatch = false,
		} = {}) {
	let originalGroups = getReferencedOriginalGroups(v.unmapped.similar);
	let ogKeyToGroups = new Map();
	for (let og of originalGroups) {
		let k = getOriginalGroupKey(og, onlyStrongs);
		ogKeyToGroups.set(k, (ogKeyToGroups.get(k) || []).concat(og));
	}

	for (let [ogKey, ogsForKey] of ogKeyToGroups.entries()) {
		function maybeSatisfy(translatedWords) {
			if (discardInsignificantWords && translatedWords.length > 1)
				translatedWords = translatedWords.filter(w => !INSIGNIFICANT_WORDS.has(w));
			if (!translatedWords.length) return false;

			let match = matchSequence(side, v.unmapped.translation, translatedWords, looseMatch);
			if (match.length == ogsForKey.length) {
				for (let ogi = 0; ogi < ogsForKey.length; ogi++) {
					let og = ogsForKey[ogi];
					for (let ti = 0; ti < v.unmapped.translation.length; ti++) {
						if (v.unmapped.translation[ti] == match[ogi][0]) {
							if (onlyStrongs) og.onlyStrongs = true;
							v.toOriginalGroups.push([v.unmapped.translation.splice(ti, match[ogi].length), [og]]);
							break;
						}
					}
					removeIfMatchingOriginalGroup(v.unmapped.similar, og);
				}
				return true;
			}
			return false;
		}

		// Try using similar's translation from this verse.
		if (maybeSatisfy(ogsForKey[0].similar.map(tk => tk['word']))) continue;

		// Try other translations, in descreasing order of occurrences (first KJV, then maybe ESV).
		let alternates = Array.from(side.groupTranslations[ogKey].entries());
		if (onlyStrongs) {
			// Only use translations with a certain # of occurrences, since this data isn't perfect.
			if (ogKey in esvTranslations) {
				alternates.push(...esvTranslations[ogKey].filter(([translation, count]) => count >= 2));
			}
		}

		for (let [translatedWords, count] of alternates) {
			translatedWords = translatedWords.split(' ');
			if (maybeSatisfy(translatedWords)) break;
		}
	}
}

function mapUniqueMergingOriginalGroups(side, v) {
	let originalGroups = getReferencedOriginalGroups(v.unmapped.similar);
	let ogKeyToGroups = new Map();
	for (let ogi = 0; ogi < originalGroups.length - 1; ogi++) {
		let k = getOriginalGroupKey(originalGroups[ogi], true) + ' ' + getOriginalGroupKey(originalGroups[ogi + 1], true);
		ogKeyToGroups.set(k, (ogKeyToGroups.get(k) || []).concat([originalGroups.slice(ogi, ogi + 2)]));
	}

	for (let [ogKey, ogDblsForKey] of ogKeyToGroups.entries()) {
		function maybeSatisfy(translatedWords) {
			translatedWords = translatedWords.filter(w => !INSIGNIFICANT_WORDS.has(w));
			if (!translatedWords.length) return false;

			let match = matchSequence(side, v.unmapped.translation, translatedWords);
			if (match.length == ogDblsForKey.length) {
				for (let ogi = 0; ogi < ogDblsForKey.length; ogi++) {
					let og = ogDblsForKey[ogi][0];
					for (let ti = 0; ti < v.unmapped.translation.length; ti++) {
						if (v.unmapped.translation[ti] == match[ogi][0]) {
							og.onlyStrongs = true;
							v.toOriginalGroups.push([v.unmapped.translation.splice(ti, match[ogi].length), ogDblsForKey[ogi]]);
							break;
						}
					}
					ogDblsForKey[ogi].forEach(og => removeIfMatchingOriginalGroup(v.unmapped.similar, og));
				}
				return true;
			}
			return false;
		}

		let alternates = (esvTranslations[ogKey] || []);

		for (let [translatedWords, count] of alternates) {
			translatedWords = translatedWords.split(' ');
			if (maybeSatisfy(translatedWords)) break;
		}
	}
}

function matchSequence(side, wordTokens, subWords, loose = false) {
	if (!loose) {
		let matches = [];
		for (let wi = 0; wi < wordTokens.length - subWords.length + 1; wi++) {
			if (wordTokens[wi]['word'] == subWords[0]
					&& wordTokens.slice(wi+1, wi+1+subWords.length-1).map(tk => tk['word']).join(' ')
						== subWords.slice(1).join(' ')) {
				matches.push(wordTokens.slice(wi, wi + subWords.length));
			}
		}
		return matches;
	} else {
		function tryWordsIndividually(words) {
			for (let w of words) {
				let matches = matchSequence(side, wordTokens, [w], false);
				if (matches.length) return matches;
			}
			return [];
		}

		// Match based on rare word.
		let rareWords = subWords.filter(w => side.wordCounts[w] < 7);
		let matches = tryWordsIndividually(rareWords);
		if (matches.length) return matches;

		// Match based on long word.
		let longWords = subWords.filter(w => w.length >= 7);
		matches = tryWordsIndividually(rareWords);
		if (matches.length) return matches;

		// Match based on edit distance on long word.
		if (longWords.length) {
			for (let w of longWords) {
				let matches = wordTokens.filter((tk, i) => {
					let distance = getEditDistance(tk['word'], longWords[0]);
					if (distance == 1)
						return true;
					return false;
				}).map(tk => [tk]);
				if (matches.length) return matches;

				matches = wordTokens.filter((tk, i) => {
					let distance = getEditDistance(tk['word'], longWords[0]);
					if (distance < longWords[0].length / 3)
						return true;
					return false;
				}).map(tk => [tk]);
				if (matches.length) return matches;
			}
		}

		// Match based on medium-use word.
		let mediumUseWords = subWords.filter(w => side.wordCounts[w] < 100);
		matches = tryWordsIndividually(mediumUseWords);
		if (matches.length) return matches;

		return [];
	}
}

// Map single unmapped original between two mapped original terms (or term and boundary).
function mapTrapped(side, v) {
	let unmappedOrigGroups = getReferencedOriginalGroups(v.unmapped.similar);
	let mappedOrigGroupByIndex = v.originalGroups.concat();
	unmappedOrigGroups.forEach(og => mappedOrigGroupByIndex[og.i] = undefined);
	let mappedOrigGroupToTranslation =
		new Map(
			v.toOriginalGroups.map(
				([translationTks, ogs]) => ogs.map(og => [og, translationTks])).flat());

	for (let og of unmappedOrigGroups) {
		let left;
		if (og.i == 0) {
			left = true;
		} else {
			left = mappedOrigGroupByIndex[og.i - 1];
		}
		if (!left)
			continue;

		let right;
		if (og.i == v.originalGroups.length - 1) {
			right = true;
		} else {
			right = mappedOrigGroupByIndex[og.i + 1];
		}
		if (!right)
			continue;

		// This og is trapped between two mapped ogs.
		let start = 0;
		if (typeof(left) != 'boolean') {
			start = Math.max(...mappedOrigGroupToTranslation.get(left).map(trTk => trTk.wi)) + 1;
		}
		let end = v.translation.length;
		if (typeof(right) != 'boolean') {
			end = Math.min(...mappedOrigGroupToTranslation.get(right).map(trTk => trTk.wi));
		}
		let translationTks = v.translation.slice(start, end);
		v.toOriginalGroups.push([translationTks, [og]]);
		for (let tki = 0; tki < v.unmapped.translation.length; tki++) {
			let wi = v.unmapped.translation[tki].wi;
			if (wi >= end) {
				break;
			} else if (wi >= start) {
				v.unmapped.translation.splice(tki--, 1);
			}
		}
		removeIfMatchingOriginalGroup(v.unmapped.similar, og);
	}
}

function logProblems(side, v) {
	if (!v.unmapped.similar.length)
		return;

	// To JSON.

	console.log('='.repeat(10), v.ref, '='.repeat(10));
	console.log(JSON.stringify(v.unmapped.translation.map(t => t['word'])));
	for (let g of getReferencedOriginalGroups(v.unmapped.similar)) {
		console.log(getOriginalGroupKey(g, true) + '=' + g.similar.map(tk => tk['word']).join(' '));
		console.log('    ' + Array.from(side.groupTranslations[getOriginalGroupKey(g, true)].keys()).join('\n    '));
	}
	console.log(v.toOriginalGroups
		.map(
			([ts, ogs]) =>
				ts.map(t => t['word']).join(' ') + '='
					+ ogs.map(og => og.similar.map(tk => tk['word'])).flat().join(' ')));
	console.log();
}