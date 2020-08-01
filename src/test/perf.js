import * as bibles from '../common/bibles.js';
import * as books from '../common/books.js';
import * as refs from '../common/refs.js';
import * as widths from '../processing/layout/widths.js';
import text from './text.js';

window.widths = widths;

document.getElementById('verseCount').value = new URLSearchParams(location.search).get('v') || 1364;

let g_bookElem = document.getElementById('book');
let g_verses = Object.entries(text);
let g_book = bibles.VerseTextToTokenConverter.convertBook('je', text);
let g_verseCount;

// All verses:
//   intel core i5-7200U
//     Chrome84: 1s
//     FF78: 20s [sometimes displays fragments earlier, takes forever to clear also]
//   ipad6 (safari12.0: 18s)
// 500 verses:
//   intel core i5-7200U (ff78: 2.3s)
//   ipad6 (safari12.0: 2s)
// 50 verses, moto e5 play (chrome84: 1.9s)
function toNodes1() {
	return makeHtmlForTokenRange1(g_book, [0, g_book['tokens'].length]);
}

function makeHtmlForTokenRange1(
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

	let verseCount = -1;

	for (let tki = tkiStart; tki < tkiEnd; tki++) {
		if (ri < refs.length - 1 && tki == refs[ri+1][1]) {
			verseCount++;
			if (verseCount == g_verseCount) break;

			ri++;
			let ref = refs.parse(bk['code'] + refs[ri][0]);
			if (verseNums) {
				h.push(`<verse-num name="${ref}">${ref.verse}</verse-num>`);
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
		}
	}
	return h.join('');
}

// All verses:
//   intel core i5-7200U (Chrome84: 170ms, FF78: 150ms)
//   ipad6 (safari12.0: 160ms)
// 200 verses, moto e5 play (chrome84: 2.2s)
// 50 verses, moto e5 play (chrome84: 170ms)
function toText() {
	let h = [];
	for (let [ref, text] of g_verses.slice(0, g_verseCount)) {
		h.push(ref.split(':')[1]);
		h.push(text);
	}
	return h.join(' ');
}

// All verses:
//   Intel Core i5-7200U (Chrome84: 190ms, FF78: 250ms)
//   ipad6 (safari12.0: 110ms)
// 200 verses, moto e5 play (chrome84: 500ms)
// 50 verses, moto e5 play (chrome84: 140ms)
function toTextPlusVerseNodes() {
	let h = [];
	for (let [ref, text] of g_verses.slice(0, g_verseCount)) {
		h.push(`<span name="${ref}">${ref.split(':')[1]}</span>`);
		h.push(text);
	}
	return h.join(' ');
}

// All verses:
//   intel core i5-7200U:
//     chrome84: 1s
//     ff78: 2s [still takes long time to clear though]
//   ipad6 (safari12.0: 400ms)
// 500 verses:
//   intel core i5-7200U (chrome84: 400ms, ff78: 700ms)
//   ipad6 (safari12.0: 150ms)
// 50 verses, moto e5 play (chrome84: 1.8s)
//
// Conclusion: Greatly improves ff and safari's render time, but not enough for moto e5 and still
// quite slow generally.
function toNodes1Hierarchy() {
	return makeHtmlForTokenRange2(g_book, [0, g_book['tokens'].length]);
}

function makeHtmlForTokenRange2(
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

	let verseCount = -1;

	for (let tki = tkiStart; tki < tkiEnd; tki++) {
		if (ri < refs.length - 1 && tki == refs[ri+1][1]) {
			verseCount++;
			if (verseCount == g_verseCount) break;

			ri++;
			let ref = refs.parse(bk['code'] + refs[ri][0]);

			if (ri == 0 || ref.chapter != refs.parseChapter(refs[ri-1][0])) {
				if (ref.chapter != 1 && tki != tkiStart)
					h.push(`</chapter>`);
				h.push('<chapter>');
			}

			if (verseNums) {
				if (tki != tkiStart)
					h.push('</verse>');
				h.push('<verse>');
				h.push(`<verse-num name="${ref}">${ref.verse}</verse-num>`);
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
		}
	}
	h.push('</verse></chapter>');
	return h.join('');
}

let tokenToWidth = {};
window.setTimeout(() => {
	let tokens = g_book['tokens'];
	for (let tki = 0; tki < tokens.length; tki++) {
		let tk = tokens[tki];
		let writable;
		if ('word' in tk) {
			writable = tk['word'];
		} else if ('punctuation' in tk) {
			writable = tk['punctuation'];
		}
		if (!(writable in tokenToWidth)) {
			tokenToWidth[writable] = width.getWidth(writable, {fontSize: '16px', fontFamily: 'Open Sans', letterSpacing: '2px'});
		}
	}
	window.tokenToWidth = tokenToWidth;
	document.getElementById('absNodes').disabled = false;
	document.getElementById('lines').disabled = false;
	document.getElementById('linesStr').disabled = false;
}, 2000);

// Selection is a bit ugly, and scrolling on desktop chrome is not smooth.
function toAbsNodes() {
	let lineWidth = 300;

	let tokens = g_book['tokens'];
	let elem = document.createElement('div');
	elem.style.position = 'relative';
	let pos = {x: 0, y: 0};

	let refs = Object.entries(g_book['refs']);
	let ri = 0;
	for (; ri < refs.length; ri++) {
		if (refs[ri][1] >= 0) {
			break;
		}
	}
	ri--;

	let verseCount = -1;
	for (let tki = 0; tki < tokens.length; tki++) {
		if (ri < refs.length - 1 && tki == refs[ri+1][1]) {
			verseCount++;
			if (verseCount == g_verseCount) break;
			ri++;
		}

		let tk = tokens[tki];
		let writable;
		if ('word' in tk) {
			writable = tk['word'];
		} else if ('punctuation' in tk) {
			writable = tk['punctuation'];
		}
		if (writable) {
			let abs = document.createElement('abs');
			abs.innerText = writable;
			abs.style.top = pos.y + 'px';
			abs.style.left = pos.x + 'px';
			elem.appendChild(abs);
			pos.x += tokenToWidth[writable];
			continue;
		}
		if ('layout' in tk) {
			if (tk['layout'] == 'space') {
				if (pos.x + 6 > lineWidth) {
					pos.x = 0;
					pos.y += 22;
				} else {
					pos.x += 6;
				}
			}
		}
	}
	return elem;
}

function toLines() {
	let lineWidth = 300;

	let tokens = g_book['tokens'];
	let elem = document.createElement('div');
	let pos = {x: 0, y: 0};

	let refs = Object.entries(g_book['refs']);
	let ri = 0;
	for (; ri < refs.length; ri++) {
		if (refs[ri][1] >= 0) {
			break;
		}
	}
	ri--;

	let lineElem = document.createElement('div');
	elem.appendChild(lineElem);

	let verseCount = -1;
	for (let tki = 0; tki < tokens.length; tki++) {
		if (ri < refs.length - 1 && tki == refs[ri+1][1]) {
			verseCount++;
			if (verseCount == g_verseCount) break;
			ri++;
		}

		let tk = tokens[tki];
		let writable;
		if ('word' in tk) {
			writable = tk['word'];
		} else if ('punctuation' in tk) {
			writable = tk['punctuation'];
		}
		if (writable) {
			lineElem.innerText += writable;
			pos.x += tokenToWidth[writable];
			continue;
		}
		if ('layout' in tk) {
			if (tk['layout'] == 'space') {
				lineElem.innerText += ' ';
				if (pos.x + 6 > lineWidth) {
					pos.x = 0;
					pos.y += 22;
					lineElem = document.createElement('div');
					elem.appendChild(lineElem);
				} else {
					pos.x += 6;
				}
			}
		}
	}
	return elem;
}

// All verses:
//   intel core i5-7200U (chrome84: 170ms, ff78: 150ms, edge84: 130ms)
//   ipad6 (safari12.0: 100ms)
// 150 verses, moto e5 play (chrome84: 500ms)
// 50 verses, moto e5 play (chrome84: 200ms)
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

			let ref = refs.parse(g_book['code'] + refs[ri][0]);
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

function toClear() { return ' '; }

window.addEventListener('click', e => {
	if (e.target.tagName != 'INPUT' || e.target.type != 'button') return;

	g_verseCount = parseInt(document.getElementById('verseCount').value);

	let fn = eval('to' + e.target.value);
	let start = performance.now();
	let htmlOrNode = fn();
	let afterHtml = performance.now();
	if (typeof(htmlOrNode) == 'string') {
		g_bookElem.innerHTML = htmlOrNode;
	} else {
		g_bookElem.appendChild(htmlOrNode);
	}
	let afterSet = performance.now();
	window.setTimeout(
		() => document.getElementById('time').value
			= `${(afterHtml - start).toFixed(0)}ms ${(afterSet - afterHtml).toFixed(0)}ms ${(performance.now() - afterSet).toFixed(0)}ms`,
		0);
});