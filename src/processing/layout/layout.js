import {makeElem, onLoad} from '../../common/utils.js';
import * as widths from './widths.js'; 

onLoad.then(() => {
	let promises = [];
	promises.push(fetch('../../../build/resources/lsv_book_token.json')
		.then(response => response.json()));
	promises.push(fetch('../../../build/resources/strongs.json')
		.then(response => response.json()));
	Promise.all(promises).then(([b1, strongs]) => {
		window.setTimeout(() => {  // wait for fonts to load
			computeWidths(b1, strongs);
		}, 5000);
	});
});

function computeWidths(bible, strongs) {
	let textToWidth = {};
	let englishParams = {fontSize: '16px', fontFamily: 'Open Sans', iterations: 10};
	let greekParams = {fontSize: '16px', fontFamily: 'Source Sans Pro', iterations: 10};
	let hebrewParams = {fontSize: '16px', fontFamily: 'Cardo', iterations: 10};

	for (let bk of Object.values(bible)) {
		let tokens = bk['tokens'];
		for (let tki = 0; tki < tokens.length; tki++) {
			let tk = tokens[tki];
			let writable;
			if ('word' in tk) {
				writable = tk['word'];
			} else if ('punctuation' in tk) {
				writable = tk['punctuation'];
			}
			if (writable && (!(writable in textToWidth) || writable == 'constructor')) {
				let strong = tk['strong'];
				let params;
				if (strong) {
					params = strong[0] == 'G' ? greekParams : hebrewParams;
				} else {
					params = englishParams;
				}
				textToWidth[writable] = () => widths.getWidth(writable, params);
			}
		}
	}
	for (let writable of ['[', ']'].concat(Array.from(Array(200), (_, i) => '' + i))) {
		textToWidth[writable] = () => widths.getWidth(writable, englishParams);
	}
	for (let [strong, tuple] of Object.entries(strongs)) {
		textToWidth[tuple['lemma']] = () => widths.getWidth(tuple['lemma'], strong[0] == 'G' ? greekParams : hebrewParams);
	}

	function finish() {
		textToWidth = Object.fromEntries(Object.entries(textToWidth)
			.map(([k, v]) => [k, parseFloat(v.toFixed(1))]));

		document.body.appendChild(
			makeElem(JSON.stringify(textToWidth, null, '\n').replace(/\n+/g, '<br/>'), 'div'));
	}

	let entries = Object.entries(textToWidth);
	let progressElem = document.createElement('div');
	document.body.appendChild(progressElem);
	function doWork() {
		for (let i = 0; i < 1000; i++) {
			if (entries.length == 0) {
				progressElem.parentElement.removeChild(progressElem);
				finish();
				return;
			}
			let [k, fn] = entries.pop();
			textToWidth[k] = fn();
		}
		progressElem.appendChild(makeElem('<div>' + entries.length + '</div>'));
		window.setTimeout(doWork, 500);
	}
	doWork();
}