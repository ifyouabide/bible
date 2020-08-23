// Utils for dealing with bibles in various formats. See README.md for more info.

export const format = {
	unknown: 0,
	// Verse-centric bibles:
	// A map of code -> book; each book is a map of chapter:verse -> text format.
	verseText: 'verse-text',
	// A map of code -> book; each book is a map of chapter:verse -> token.
	verseToken: 'verse-token',

	// Book-centric bibles:
	// A map of code -> book; each book contains a list of tokens and a map of
	// chapter:verse -> starting token index.
	bookToken: 'book-token',
};

export function getFormat(bible) {
	if (typeof(bible) != 'object') return format.unknown;
	
	let bk = Object.values(bible)[0];
	if (!bk || typeof(bk) != 'object') return format.unknown;

	if ('tokens' in bk) return format.bookToken;

	let v1 = Object.values(bk)[0];
	if (!v1) return format.unknown;

	if (typeof(v1) == 'string') return format.verseText;
	if (v1 instanceof Array) return format.verseToken;
	return format.unknown;
}

const PUNCTUATION_CHARS = '…,;:.?!-—\'‘’"“”(){}[]'.split('');
const LAYOUT_CHARS = ' \n\t\f\r'.split('');
const Type = {
	unknown: 0,
	punctuation: 1,
	layout: 2,
};
const CHAR_TO_TYPE = new Uint8Array(10000);
PUNCTUATION_CHARS.forEach(c => CHAR_TO_TYPE[c.codePointAt(0)] = Type.punctuation);
LAYOUT_CHARS.forEach(c => CHAR_TO_TYPE[c.codePointAt(0)] = Type.layout);

const SPACE_TOKEN = {'layout': 'space'};
const NEW_LINE0_TOKEN = {'layout': {'newLine': 0}};
const LAYOUT_KEY_TO_TOKEN = {
	'\n0': NEW_LINE0_TOKEN,
};

function isInWord(c, prev) {
	if (!CHAR_TO_TYPE[c.codePointAt(0)]) return true;

	// Hyphens and apostrophes can be in a word. Check for them.
	if (!prev) return false;
	return !CHAR_TO_TYPE[prev.codePointAt(0)] && (c == '-' || c == '\'' || c == '’');
}

function convertNonWord(text, indexRef = {i: 0}) {
	let c = text[indexRef.i];
	if (CHAR_TO_TYPE[c.codePointAt(0)] == Type.punctuation) {
		return {'punctuation': c};
	} else if (CHAR_TO_TYPE[c.codePointAt(0)] == Type.layout) {
		if (c == ' ') return SPACE_TOKEN;
		let count = 0;
		while (text[indexRef.i+count+1] == '\t')
			count++;
		indexRef.i += count;
		return LAYOUT_KEY_TO_TOKEN[c + count];
	} else {
		throw new Error('Unknown character: ' + c);
	}
}

// Note, identical tokens may reuse the same object, even across different invocations.
export function textToTokens(text, {tokens = [], modifiable = false} = {}) {
	let word = '';
	for (let indexRef = {i: 0}; indexRef.i < text.length; indexRef.i++) {
		let c = text[indexRef.i];
		let prev = indexRef.i > 0 ? text[indexRef.i-1] : null;
		let inWord = isInWord(c, prev);
		if (inWord) {
			word += c;
		} else {
			if (word.length) tokens.push({'word': word});
			word = '';

			let nonWord = convertNonWord(text, indexRef);
			if (modifiable) {
				tokens.push(Object.assign({}, nonWord));
			} else {
				tokens.push(nonWord);
			}
		}
	}
	if (word.length) tokens.push({'word': word});
	return tokens;
}

export function getTokenCount(textOrTokens) {
	return getTokens(textOrTokens).length;
}

export function getTokens(textOrTokens, {modifiable = false} = {}) {
	if (typeof(textOrTokens) == 'string')
		return textToTokens(textOrTokens, {modifiable: modifiable});
	return modifiable ? JSON.parse(JSON.stringify(textOrTokens)) : textOrTokens;
}

// Utils for verse-centric bibles (either text or token based).
export const verse = {
	toBookTokenBook: (bkCode, verses) => {
		let tokens = [];
		let refs = {};
		for (let [ref, text] of Object.entries(verses)) {
			refs[ref] = tokens.length;
			tokens.push(...getTokens(text));
		}
		return {
			'code': bkCode,
			'tokens': tokens,
			'refs': refs,
		};
	},

	toBookTokenBible: bible => {
		return Object.fromEntries(
			Object.entries(bible).map(
				([k, v]) => [k, verse.toBookTokenBook(k, v)]));
	},

	toBookTokenMap: (bibleMap, leftVerseBible, rightVerseBible) => {
		let out = {};
		for (let [bkCode, bk] of Object.entries(bibleMap)) {
			out[bkCode] = [];
			let leftOffset = 0;
			let rightOffset = 0;
			for (let [ref, pairList] of Object.entries(bk)) {
				for (let i = 0; i < pairList.length; i++) {
					out[bkCode].push([
						pairList[i][0].map(i => i + leftOffset),
						pairList[i][1].map(i => i + rightOffset),
					]);
				}
				leftOffset += getTokenCount(leftVerseBible[bkCode][ref]);
				rightOffset += getTokenCount(rightVerseBible[bkCode][ref]);
			}
		}
		return out;
	},

	mergeNamed: nameToBible => {
		let out = {};
		function merge(name, bible) {
			for (let [bkCode, bk] of Object.entries(bible)) {
				if (!out[bkCode]) out[bkCode] = {};
				let outBk = out[bkCode];
				for (let [ref, val] of Object.entries(bk)) {
					if (!outBk[ref]) outBk[ref] = {};
					outBk[ref][name] = val;
				}
			}
		}
		for (let [k, v] of Object.entries(nameToBible)) {
			merge(k, v);
		}
		return out;
	},

	unmergeNamed: mergedBible => {
		let out = {};
		for (let [bkCode, bk] of Object.entries(mergedBible)) {
			for (let [ref, merged] of Object.entries(bk)) {
				for (let [k, v] of Object.entries(merged)) {
					if (!out[k]) out[k] = {};
					if (!out[k][bkCode]) out[k][bkCode] = {};
					if (!out[k][bkCode][ref]) out[k][bkCode][ref] = {};
					out[k][bkCode][ref] = v;
				}
			}
		}
		return out;
	},

	flatten: bible => {
		let flat = {};
		for (let [bkCode, bk] of Object.entries(bible)) {
			for (let [ref, val] of Object.entries(bk)) {
				flat[bkCode + ref] = val;
			}
		}
		return flat;
	},
};

export function stringifyMap(map) {
	return map.map(([e, o]) => e.join(',') + '=' + o.join(',')).join(' ');
}

export function seekTkiByWordCount(unit, tki, wc) {
	for (
		tki = tki + Math.sign(wc);
		tki > 0 && tki < unit['tokens'].length && wc;
		tki += Math.sign(wc)) {
		if ('word' in unit['tokens'][tki]) wc -= Math.sign(wc);
	}
	if (tki < 0) return 0;
	if (tki >= unit['tokens'].length) return unit['tokens'].length - 1;
	return tki;
}