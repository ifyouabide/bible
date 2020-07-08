const g_punctuationChars = new Set('…,;:.?!-—\'"‘’“”(){}'.split(''));

const g_layoutChars = new Set(' \n\t\f\r'.split(''));

const g_translationChars = new Set('|[]'.split(''));

const g_nonWordChars = new Set(
	Array.from(g_punctuationChars)
		.concat(Array.from(g_layoutChars))
		.concat(Array.from(g_translationChars)));

export const VerseTextToTokenConverter = {
	convertText: (bkCode, text) => {
		let tokens = [];
		let word = '';
		let chars = Array.from(text);
		for (let i = 0; i < chars.length; i++) {
			let prev = i > 0 ? chars[i-1] : null;
			let next = i < chars.length - 1 ? chars[i+1] : null;
			let c = chars[i];

			let inWord = (() => {
				if (!g_nonWordChars.has(c)) return true;

				// Hyphens and apostrophes can be in a word. Check for them.
				if (!prev) return false;
				return !g_nonWordChars.has(prev) && (c == '-' || c == '\'' || c == '’');
			})();

			if (inWord) {
				word += c;
			} else {
				if (word.length) tokens.push({word: word});
				word = '';

				if (c == '[') {
					if (next == '[') {
						tokens.push({translation: {disputed: 'begin'}});
						i++;
					} else {
						tokens.push({translation: {noOriginal: 'begin'}});
					}
				} else if (c == ']') {
					if (next == ']') {
						tokens.push({translation: {disputed: 'end'}});
						i++;
					} else {
						tokens.push({translation: {noOriginal: 'end'}});
					}
				} else if (c == '|') {
					if (next == '|') {
						tokens.push({layout: {newLine: 1}});
						i++;
					} else {
						let inner = chars.slice(i+1).join('').split('|', 1)[0];
						tokens.push({note: parseInt(inner)});
						i += inner.length + 1;
					}
				} else if (g_layoutChars.has(c)) {
					let val = {
						' ': 'space',
						'\n': 'newParagraph',
						'\f': 'blankLine',
						'\r': 'endLine',
					}[c];
					if (val) {
						tokens.push({layout: val});
					} else {
						if (c == '\t') {
							if (next == '\t') {
								tokens.push({layout: {newLine: 2}});
								i++;
							} else {
								tokens.push({layout: {newLine: 1}});
							}
						} else {
							throw new Error('Unknown layout char: ' + c);
						}
					}
				} else if (g_punctuationChars.has(c)) {
					tokens.push({punctuation: c});
				} else {
					throw new Error('Unknown character: ' + c);
				}
			}
		}
		if (word.length) tokens.push({word: word});
		return tokens;
	},

	convertBook: (bkCode, verses) => {
		let tokens = [];
		let refs = {};
		for (let [ref, text] of Object.entries(verses)) {
			refs[ref] = tokens.length;
			tokens.push(...VerseTextToTokenConverter.convertText(bkCode, text));
		}
		return {
			code: bkCode,
			tokens: tokens,
			refs: refs,
		};
	},

	convertBible: (bible) => {
		return Object.fromEntries(
			Object.entries(bible).map(
				([k, v]) => [k, VerseTextToTokenConverter.convertBook(k, v)]));
	},
};