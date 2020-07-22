import * as bible_utils from './bible_utils.js';
import {ifDebug, Timer, exportDebug} from '../common/utils.js';
import * as resources from './resources.js';

export function createElement({id} = {}) {
	let elem = document.createElement('div');
	if (id) elem.setAttribute('id', id);
	elem.setAttribute('tabindex', 0);
	elem.toggleAttribute('data-has-history');

	let contentElem = document.createElement('div');
	elem.appendChild(contentElem);

	let spacingElem = document.createElement('div');
	spacingElem.style.minHeight = '100vh';

	elem.show = function(refRange, {scrollToRef} = {}) {
		ifDebug(() => {
			console.log('show', refRange.toString(), scrollToRef ? `scroll: ${scrollToRef}` : '')
		});

		if (!refRange.isWithinSingleBook() || !refRange.exists()) return false;
		if (scrollTo && !scrollToRef.exists()) return false;

		/*if (!opts.skipCommit && g_bookElem.querySelector('#text') != null) {
			let params = new URLSearchParams(window.location.search);
			addHistory(getCurrentRef(), params.get('psg'));
		}*/

		//let isRange = refRangeStr.indexOf('-') != -1;
		//let psg = opts.psg || (opts.highlight || isRange ? refRangeStr : null);

		if (elem.getAttribute('data-ref-range') != refRange.toString()) {			
			let timer = new Timer();
			let html = makeHtmlForRefRange(refRange);
			ifDebug(() => console.log('show [built]', refRange.toString(), timer.mark()));
			contentElem.innerHTML = html;
			ifDebug(() => console.log('show [parsed]', refRange.toString(), timer.mark()));
			elem.setAttribute('data-ref-range', refRange.toString());
			elem.setAttribute('data-book', refRange.start.book);
			elem.appendChild(spacingElem);
		}

		if (scrollToRef) {
			scrollTo(elem, elem.querySelector(`verse-num[name="${scrollToRef}"]`));
		}
		return true;
	};
	elem.showTokensAndSurrounding = function(bkCode, tkis, {include = 7} = {}) {
		if (!tkis.length) return false;

		let pairs = tkis.sort((a, b) => a - b).map(tki =>
			[
				bible_utils.seekTkiByWordCount(resources.bible[bkCode], tki, -include),
				bible_utils.seekTkiByWordCount(resources.bible[bkCode], tki, include),
			]
		);
		let collapsed = [];
		let left = pairs[0];
		while (pairs.length) {
			let left = pairs.splice(0, 1)[0];
			let right = pairs[0];
			if (right && left[1] >= right[0]) {
				pairs[0] = [left[0], Math.max(left[1], right[1])];
			} else {
				collapsed.push(left);
			}
		}

		let refRange = bible_utils.RefRange.containingTkis(bkCode, collapsed.flat());
		let refRangeHtml = `<a class="ref-range">${refRange}</a>`;

		contentElem.innerHTML = refRangeHtml + '...' + collapsed
			.map(p => makeHtmlForTokenRange(
				resources.bible[bkCode], p, {headings: false, verseNums: false}))
			.join('...') + '...';
		elem.setAttribute('data-book', refRange.start.book);
		return true;
	};
	elem.highlightHits = function(hits) {
		Array.from(elem.querySelectorAll('w.highlight'))
			.forEach(e => e.classList.remove('highlight'));
		hits.filter(h => h.book == elem.getAttribute('data-book')).forEach(h => {
			let tokenElem = elem.getElemForToken(h.tokenIndex);
			if (tokenElem) tokenElem.classList.add('highlight');
		});
	};
	elem.highlightPassage = function(refOrRange, highlightPassagePermanently = true) {
		let refRange = refOrRange instanceof bible_utils.Ref
			? new bible_utils.RefRange(refOrRange, refOrRange) : refOrRange;
		if (!refRange.isWithinSingleBook() || !refRange.exists()) return false;

		Array.from(elem.querySelectorAll('verse-num.highlight, end-of-chapter.highlight'))
			.forEach(e => e.classList.remove('highlight'));
		Array.from(elem.querySelectorAll('verse-num.temp-highlight, end-of-chapter.temp-highlight'))
			.forEach(e => e.classList.remove('temp-highlight'));

		let highlightClass = highlightPassagePermanently ? 'highlight' : 'temp-highlight';
		// Need to do this asynchronously so that removing and re-adding a temp-highlight works.
		window.setTimeout(() => {
			elem.getElemForVerseNum(refRange.start).classList.add(highlightClass);
			if (refRange.end.endsChapter()) {
				elem.getElemForEndOfChapter(refRange.end.chapter).classList.add(highlightClass);
			} else {
				elem.getElemForVerseNum(refRange.end.seek()).classList.add(highlightClass);
			}
		}, 0);
	};
	elem.getElemForToken = function(tki) {
		return elem.querySelector(`w[data-tki="${tki}"]`);
	};
	elem.getElemForVerseNum = function(ref) {
		return elem.querySelector(`verse-num[name="${ref}"]`);
	};
	elem.getElemForEndOfChapter = function(ch) {
		return elem.querySelector(`end-of-chapter[name="${ch}"]`);
	}
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

function makeHtmlForTokenRange(
		bk, [tkiStart, tkiEnd],
		{headings = true, verseNums = true} = {}) {
	if (tkiStart < 0 || tkiStart >= bk['tokens'].length) throw new Error('invalid tkiStart');
	if (tkiEnd < tkiStart || tkiEnd > bk['tokens'].length) throw new Error('invalid tkiEnd');

	let h = [];
	let refs = Object.entries(bk['refs']);
	let ri = 0;
	for (; ri < refs.length; ri++) {
		if (refs[ri][1] >= tkiStart) {
			break;
		}
	}
	ri--;

	let isPsalm = bk['code'] == 'ps';

	for (let tki = tkiStart; tki < tkiEnd; tki++) {
		if (ri < refs.length - 1 && tki == refs[ri+1][1]) {
			ri++;
			let ref = bible_utils.Ref.parse(bk['code'] + refs[ri][0]);

			// Add chapter/psalm heading.
			if (headings) {
				if (ri == 0 || ref.chapter != bible_utils.Ref.parseChapter(refs[ri-1][0])) {
					if (isPsalm) {
						if (ref.chapter != 1 && tki != tkiStart) {
							h.push(`<end-of-chapter name="${ref.chapter - 1}"></end-of-chapter>`);
							h.push('<br/>'.repeat(5));
						}
						h.push(`<psalm-num>PSALM ${ref.chapter}</psalm-num>`);
					} else {
						if (ref.chapter != 1 && tki != tkiStart)
							h.push(`<end-of-chapter name="${ref.chapter - 1}"></end-of-chapter>`);
						h.push(`<chapter-num>CHAPTER ${ref.chapter}</chapter-num>`);
					}
				}
			}

			// Add verse number.
			if (verseNums) {
				if (isPsalm) {
					if (ref.verse == 0) {
						h.push(`<verse-num name="${ref}"></verse-num><verse-num name="${ref.seek()}">1</verse-num>`);
					} else if (ref.verse != 1 || ri == 0 || bible_utils.Ref.parseVerse(refs[ri-1][0]) != 0) {
						h.push(`<verse-num name="${ref}">${ref.verse}</verse-num>`);
					}
				} else {
					h.push(`<verse-num name="${ref}">${ref.verse}</verse-num>`);
				}
			}
		}

		let tk = bk['tokens'][tki];
		if ('word' in tk) {
			h.push(`<w data-tki="${tki}">` + tk['word'] + '</w>');
		} else if ('layout' in tk) {
			if (tk['layout'] == 'space') {
				h.push(' ');
			} else if ('newLine' in tk['layout']) {
				h.push(`<new-line>||</new-line>`);
			}
		} else if ('punctuation' in tk) {
			h.push(tk['punctuation']);
		} else if ('translation' in tk) {
			if ('noOriginal' in tk['translation']) {
				h.push(tk['translation']['noOriginal'] == 'begin' ? '[' : ']');
			} else if ('disputed' in tk['translation']) {
				h.push(tk['translation']['disputed'] == 'begin' ? '[[' : ']]');
			}
		}
	}
	if (headings) {
		h.push(`<end-of-chapter name="${bible_utils.Ref.parseChapter(refs[ri][0])}"></end-of-chapter>`);
	}
	return h.join('');
}
/*
function toLinesStr() {
	let lineWidth = 550;

	let tokens = g_book['tokens'];
	let h = [];
	h.push('<div>');
	let pos = {x: 0, y: 0};

	let refs = Object.entries(g_book['refs']);
	let ri = 0;
	for (; ri < refs.length; ri++) {
		if (refs[ri][1] >= 0) {
			break;
		}
	}
	ri--;

	h.push('<div style="word-spacing:5px;">');

	let verseCount = -1;
	for (let tki = 0; tki < tokens.length; tki++) {
		if (ri < refs.length - 1 && tki == refs[ri+1][1]) {
			verseCount++;
			if (verseCount == g_verseCount) break;
			ri++;

			let ref = parse(g_book['code'] + refs[ri][0]);
			h.push(`<verse-num name="${ref}">${ref.verse}</verse-num>`);
		}

		let tk = tokens[tki];
		let writable;
		if ('word' in tk) {
			writable = tk['word'];
		} else if ('punctuation' in tk) {
			writable = tk['punctuation'];
		}
		if (writable) {
			h.push(writable);
			pos.x += tokenToWidth[writable];
			continue;
		}
		if ('layout' in tk) {
			if (tk['layout'] == 'space') {
				h.push(' ');
				if (pos.x + 6 > lineWidth) {
					pos.x = 0;
					pos.y += 22;
					h.push('</div><div>');
				} else {
					pos.x += 6;
				}
			}
		}
	}

	h.push('</div></div>');
	return h.join('');
}
*/
function getContainerLineHeight(container) {
	// getComputedStyle().lineHeight is imprecise
	var e = document.createElement('div');
	e.style.maxWidth = '20px';

	e.innerHTML = `<span>l</span>${'<div>&nbsp;</div>'.repeat(99)}<span>l</span>`;

	container.appendChild(e);
	var lineHeight = (e.lastChild.getClientRects()[0].y - e.firstChild.getClientRects()[0].y) / 100;
	container.removeChild(e);
	return lineHeight;
}

function scrollTo(elem, childElem) {
	var lineHeight = getContainerLineHeight(elem);
	var fontSize = parseInt(getComputedStyle(elem).fontSize);
	var space = (lineHeight - fontSize) / 2;

	childElem.scrollIntoView();
	elem.scrollTop -= elem.offsetHeight * .3;
	var offFromTopline = (elem.scrollTop + elem.offsetHeight * .3 - elem.firstChild.offsetTop) % lineHeight;
	elem.scrollTop += space + fontSize - offFromTopline;
}
exportDebug('scrollTo', scrollTo);