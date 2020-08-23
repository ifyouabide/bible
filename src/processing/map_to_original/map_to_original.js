// This module is used by nodejs and non-nodejs, so take care what is imported.

function setIfUnset(o, key, initialValue) {
	if (!o.hasOwnProperty(key)) {
		o[key] = initialValue;
	}
	if (o[key] instanceof Object) {
		return o[key];
	}
	return o;
}

export function mapUsingTranslations(wordCounts, originalWordTranslationMap, bible) {
	function getStrongTranslationPairs(strongsStr, entry, remainingTks) {
		let pairs = [];
		if (remainingTks.length) {
			let sequenceTranslations = entry['sequenceTranslations'];
			if (sequenceTranslations) {
				let nextEntry = sequenceTranslations[remainingTks[0]['strong']];
				if (nextEntry) {
					pairs.push(...getStrongTranslationPairs(
						strongsStr + ' ' + remainingTks[0]['strong'],
						nextEntry,
						remainingTks.slice(1)));
				}
			}
		}
		let translations = entry['translations'];
		if (translations)
			pairs.push([strongsStr, translations]);
		return pairs;
	}

	function getPotentialMappings(v) {
		let potentials = [];
		//let consideredStrongStrs = new Set();
		for (let wi = 0; wi < v.originalTks.length; wi++) {
			let tk = v.originalTks[wi];
			let mainEntry = originalWordTranslationMap[tk['strong']];
			if (!mainEntry) continue;

			let newStrongTranslationPairs =
				getStrongTranslationPairs(tk['strong'], mainEntry, v.originalTks.slice(wi + 1))
					;//.filter(([strongsStr, translations]) => !consideredStrongStrs.has(strongsStr));

			for (let [strongsStr, translations] of newStrongTranslationPairs) {
				//consideredStrongStrs.add(strongsStr);
				let matches = [];
				for (let trans in translations) {
					let transMatches = matchSequence(
						wordCounts, v.translationTks, trans.split(' '),
						{exact: true, rare: true, long: true, mediumUse: true});
					matches.push(...transMatches);
				}
				if (matches.length) {
					potentials.push([v.originalTks.slice(wi, wi + strongsStr.split(' ').length), matches]);
					break;
				}
			}
		}
		return potentials;
	}

	function map(v, potentials) {
		let usedOrigTks = new Set();
		let usedTransTks = new Set();

		let map = [];
		for (let [origTks, potentialTransTkMatches] of potentials) {
			if (origTks.some(tk => usedOrigTks.has(tk))) continue;

			for (let transTks of potentialTransTkMatches) {
				if (transTks.some(tk => usedTransTks.has(tk))) continue;

				origTks.forEach(tk => usedOrigTks.add(tk));
				transTks.forEach(tk => usedTransTks.add(tk));
				let mapping = [
					transTks.map(tk => tk['wi']),
					origTks.map(tk => tk['wi']),
				];
				map.push(mapping);
				break;
			}
		}
		return map.sort((a, b) => Math.min(...a[0]) - Math.min(...b[0]));
	}

	for (let bkCode in bible) {
		for (let v of Object.values(bible[bkCode])) {
			let potentials = getPotentialMappings(v);
			v.map = map(v, potentials);
		}
	}
}

function getNewMatches(allMatches, matches) {
	return matches.filter(m => {
			for (let allMatch of allMatches) {
				if (m.every(m => allMatch.indexOf(m) != -1))
					return false;
			}
			return true;
		});
}

function matchSequence(
		wordCounts, wordTokens, subWords,
		{
			exact,
			rare,
			long,
			mediumUse,
		} = {}) {
	let matches = [];
	if (exact) {
		for (let wi = 0; wi < wordTokens.length - subWords.length + 1; wi++) {
			if (wordTokens[wi]['word'] == subWords[0]
					&& wordTokens.slice(wi+1, wi+1+subWords.length-1).map(tk => tk['word']).join(' ')
						== subWords.slice(1).join(' ')) {
				matches.push(wordTokens.slice(wi, wi + subWords.length));
			}
		}
	}

	function tryWordsIndividually(words) {
		if (!words.length) return [];

		let matchesPerWord = [];
		for (let [wi, w] of Object.entries(words)) {
			let wordMatches = matchSequence(wordCounts, wordTokens, [w], {exact: true});
			if (!wordMatches.length) return [];
			matchesPerWord[wi] = wordMatches;
		}

		function combo(matchesPerWord) {
			if (matchesPerWord.length > 1) {
				let matchesForSubsequentWords = combo(matchesPerWord.slice(1));
				let matchesForFirst = matchesPerWord[0];
				return matchesForFirst.map(
					matchForFirst => matchesForSubsequentWords.map(
						matchForSubsequent => matchForFirst.concat(matchForSubsequent))).flat();
			} else {
				return matchesPerWord[0];
			}
		}
		let combinations = combo(matchesPerWord);
		return getNewMatches(matches, combinations);
	}

	if (rare) {
		let rareWords = subWords.filter(w => wordCounts[w] < 7);
		matches.push(...tryWordsIndividually(rareWords));
	}

	let longWords = subWords.filter(w => w.length >= 7);
	if (long) {
		if (longWords[0] == 'nothing') {
			let x = 100;
		}
		matches.push(...tryWordsIndividually(longWords));
	}

	/*if (longEdited) {
		for (let w of longWords) {
			matches = wordTokens.filter((tk, i) => {
				let distance = getEditDistance(tk['word'], longWords[0]);
				if (distance < longWords[0].length / 3)
					return true;
				return false;
			}).map(tk => [tk]);
			if (matches.length) return matches;
		}
	}*/

	if (mediumUse) {
		let mediumUseWords = subWords.filter(w => wordCounts[w] < 100);
		matches.push(...tryWordsIndividually(mediumUseWords));
	}

	return matches;
}

export function addOriginalWordTranslation(
		map, strongs, translation, sourceName, {ref, refs, count}) {
	function add(entry, strongs) {
		if (!strongs.length) {
			let translations = setIfUnset(entry, 'translations', {});
			let translationObj = setIfUnset(translations, translation, {});
			let sourceObj = setIfUnset(translationObj, sourceName, {refs: [], count: 0});
			if (refs || ref) {
				if (!refs) refs = [ref];
				sourceObj.refs.push(...refs);
				sourceObj.count += refs.length;
			} else {
				sourceObj.count += count;
			}
		} else {
			let sequences = setIfUnset(entry, 'sequenceTranslations', {});
			add(setIfUnset(sequences, strongs[0], {}), strongs.slice(1));
		}
	}

	let entry = setIfUnset(map, strongs[0], {});
	add(entry, strongs.slice(1));
}

// Input:
// [ABC, gc]
// [A, ax]
// [AB, gx]
// [AC, ad]

// Output:
// AB -> g
// A -> a

// If only X accounts for Y in multiple cases, associate X with Y.
// Couldn't the others account for Y?

// Find things that could account for Y.
// 

export function getOriginalWordTranslationsUsingAggregateUnusedMappings(wordCounts, bible, bibleName) {
	// Ideas:
	//   -only populate the strongToWord/wordToStrong for verse if missing counts of type are equal (see jude1:15)
	//   -take tier1 and recompute excluding common verses (see jude1:15)
	//   -make score take into account closeness to missing word count


	let strongToTranslations = {};
	let strongToWordToRefs = {};
	let wordToStrongToRefs = {};

	for (let bkCode in bible) {
		for (let v of Object.values(bible[bkCode])) {
			let unusedStrongs = getUnusedTokens(v.originalTks, v.map.map(([t, o]) => o).flat()).map(tk => tk['strong']);
			let unusedTrans = getUnusedTokens(v.translationTks, v.map.map(([t, o]) => t).flat()).map(tk => tk['word']);

			for (let strong of unusedStrongs) {
				setIfUnset(strongToTranslations, strong, []).push({words: unusedTrans, ref: v.ref});
				let entry = setIfUnset(strongToWordToRefs, strong, {});
				for (let word of unusedTrans) {
					setIfUnset(entry, word, []).push(v.ref);
				}
			}

			for (let word of unusedTrans) {
				let entry = setIfUnset(wordToStrongToRefs, word, {});
				for (let strong of unusedStrongs) {
					setIfUnset(entry, strong, []).push(v.ref);
				}
			}
		}
	}

	function getScore(word, strong, excludedRefs = new Set()) {
		let wordToStrongCount = wordToStrongToRefs[word][strong].filter(ref => !excludedRefs.has(ref)).length;
		let wordCount = Object.entries(wordToStrongToRefs[word]).reduce((count, [strong, refs]) => count + refs.filter(ref => !excludedRefs.has(ref)).length, 0);
		let wordToStrongFreq = wordToStrongCount / (wordCount || 1e10);

		let strongToWordCount = strongToWordToRefs[strong][word].filter(ref => !excludedRefs.has(ref)).length;
		let strongCount = Object.entries(strongToWordToRefs[strong]).reduce((count, [word, refs]) => count + refs.filter(ref => !excludedRefs.has(ref)).length, 0);
		let strongToWordFreq = strongToWordCount / (strongCount || 1e10);

		return strongToWordFreq * wordToStrongFreq;
	}

	let wordToScores = {};
	let map = {};
	for (let [word, strongToRefs] of Object.entries(wordToStrongToRefs)) {
		let strongScorePairs = Object.entries(strongToRefs)
			.map(([strong, refs]) => [strong, refs.length])
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10)
			.map(([strong, count]) => [strong, getScore(word, strong)])
			.sort((a, b) => b[1] - a[1])

		if (strongScorePairs.length) {
			wordToScores[word] = strongScorePairs;

			function getTier1(strongScorePairs) {
				let tier1 = strongScorePairs;
				for (let scpi = 0; scpi < strongScorePairs.length - 1; scpi++) {
					if (strongScorePairs[scpi][1] / 4 > strongScorePairs[scpi+1][1]) {
						tier1 = strongScorePairs.slice(0, scpi + 1);
						break;
					}
				}
				return tier1.map(([strong, score]) => strong);
			}

			let tier1 = getTier1(strongScorePairs);
			if (tier1.length == 1) {
				addOriginalWordTranslation(map, tier1, word, bibleName, {refs: strongToRefs[tier1[0]]});
			} else if (tier1.length) {
				// Exclude common verses and rescore (see jude1:15).
				let refToStrongSet = {};
				for (let strong of tier1) {
					for (let ref of strongToRefs[strong]) {
						setIfUnset(refToStrongSet, ref, new Set()).add(strong);
					}
				}
				let excludedRefs = new Set(Object.entries(refToStrongSet).filter(([ref, set]) => set.size > 1).map(([ref, set]) => ref));
				strongScorePairs = tier1.map(strong => [strong, getScore(word, strong, excludedRefs)])
					.sort((a, b) => b[1] - a[1]);
				wordToScores[word + '-2'] = strongScorePairs;
				tier1 = getTier1(strongScorePairs);
				if (tier1.length == 1) {
					addOriginalWordTranslation(map, tier1, word, bibleName, {refs: strongToRefs[tier1[0]]});
				} else {
					// Add the mapping if no other strong in tier1 can account for the word in a verse.
					let refToCount = {};
					for (let ref of tier1.map(strong => strongToRefs[strong]).flat()) {
						setIfUnset(refToCount, ref, 0)[ref]++;
					}
					for (let strong of tier1) {
						if (strongToRefs[strong].some(ref => refToCount[ref] == 1)) {
							addOriginalWordTranslation(map, [strong], word, bibleName, {refs: strongToRefs[strong]});
						}
					}
				}
			}
		}
	}

	window.strongToWordToRefs = strongToWordToRefs;
	window.wordToStrongToRefs = wordToStrongToRefs;
	window.wordToScores = wordToScores;
	return map;
}

function getUnusedTokens(tks, usedIndices) {
	usedIndices.sort((a, b) => a - b);
	let ui = 0;
	let tki = 0;
	let unused = [];
	while (tki < tks.length) {
		if (tki === usedIndices[ui]) {
			while (tki === usedIndices[ui]) ui++;
		} else {
			unused.push(tks[tki]);
		}
		tki++;
	}
	return unused;
}

export function mergeOriginalWordTranslations(map1, map2) {
	let merged = JSON.parse(JSON.stringify(map1));
	map2 = JSON.parse(JSON.stringify(map2));

	function add(m, newStrong, newEntry) {
		let entry = setIfUnset(m, newStrong, {});
		if (newEntry['translations']) {
			entry['translations'] = Object.assign(entry['translations'] || {}, newEntry['translations']);
		}
		if (newEntry['combinationTranslations']) {
			let combinationTranslations = setIfUnset(entry, 'combinationTranslations', {});
			for (let [newSubStrong, newSubEntry] of Object.entries(newEntry['combinationTranslations'])) {
				add(combinationTranslations, newSubStrong, newSubEntry);
			}
		}
	}

	for (let [strong, entry] of Object.entries(map2)) {
		add(merged, strong, entry);
	}

	return merged;
}