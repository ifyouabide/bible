import * as bible_utils from './bible_utils.js';
import * as resources from './resources.js';
import {ifDebug} from './utils.js';

export function createElement({id} = {}) {
	let elem = document.createElement('div');
	if (id) elem.setAttribute('id', id);
	elem.toggleAttribute('data-has-history');

	elem.show = function(refRange, {scrollTo} = {}) {
		ifDebug(() => console.log('show', refRange.toString()));

		if (!refRange.isWithinSingleBook() || !refRange.exists()) return false;


		/*if (!opts.skipCommit && g_bookElem.querySelector('#text') != null) {
			let params = new URLSearchParams(window.location.search);
			addHistory(getCurrentRef(), params.get('psg'));
		}*/

		//let isRange = refRangeStr.indexOf('-') != -1;
		//let psg = opts.psg || (opts.highlight || isRange ? refRangeStr : null);

		if (this.getAttribute('data-refrange') != refRange.toString()) {
			ifDebug(() => console.log('show [building]', refRange.toString()));
			this.innerHTML = makeHtmlForRefRange(refRange);
			this.setAttribute('data-refrange', refRange.toString());
		}

		/*	.then(elem => document.body.appendChild({
				let vElem = $id(ref);
				if (vElem == null) {
					return;
				}
				scrollTo(container, vElem);

				if (!opts.skipCommit) {
					addHistory(ref, psg);
				}

				//highlightBounds(psg);

				if (isNew) {
					updateHighlights();
				}
			});*/
		return true;
	};
	return elem;
}

function makeHtmlForRefRange(refRange) {
	if (!refRange.exists()) throw new Error('nonexistent refrange: ' + refRange);
	if (!refRange.isWithinSingleBook())
		throw new Error('refrange crossing book boundary: ' + refRange);

	let bk = resources.bible[refRange.start.book];
	let limit = refRange.end.seek()
		? bk['refs'][refRange.end.seek().chapterAndVerse] : bk['tokens'].length;
	return makeHtmlForTokenRange(bk, [bk['refs'][refRange.start.chapterAndVerse], limit]);
}

function makeHtmlForTokenRange(bk, [tkiStart, tkiEnd]) {
	if (tkiStart < 0 || tkiStart >= bk['tokens'].length) throw new Error('invalid tkiStart');
	if (tkiEnd < tkiStart || tkiEnd > bk['tokens'].length) throw new Error('invalid tkiEnd');

	let h = [];
	let startingTkiToRef = new Map(Object.entries(bk['refs']).map(([k, v]) => [v, k]));

	for (let tki = tkiStart; tki < tkiEnd; tki++) {
		if (startingTkiToRef.has(tki)) {
			let ref = bible_utils.Ref.parse(bk['code'] + startingTkiToRef.get(tki));
			if (ref.startsChapter()) {
				let ch = bible_utils.Ref.parseChapter(startingTkiToRef.get(tki));
				h.push(`<chapter-num>CHAPTER ${ch}</chapter-num>`);
			}
			h.push(`<verse-num name="${ref}">${ref.verse}</verse-num>`);
		}

		let tk = bk['tokens'][tki];
		if ('word' in tk) {
			h.push('<w>' + tk['word'] + '</w>');
		} else if ('layout' in tk) {
			if (tk['layout'] == 'space') {
				h.push(' ');
			}
		} else if ('punctuation' in tk) {
			h.push(tk['punctuation']);
		} else if ('note' in tk) {

		} else if ('translation' in tk) {

		}
	}
	return h.join('');
}