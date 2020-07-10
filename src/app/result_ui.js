import * as bible_ui from './bible_ui.js';

export function createElement({id} ={}) {
	let elem = document.createElement('div');
	if (id) elem.setAttribute('id', id);

	elem.showHtml = html => {
		elem.innerHTML = html;
	};
	elem.show = results => {
		elem.innerHTML = '';
		for (let psg of results.passages) {
			let psgElem = bible_ui.createElement();
			psgElem.showTokensAndSurrounding(
				psg.book,
				psg.hits.map(h => h.tokenIndex));
			psgElem.highlight(psg.hits.map(h => h.tokenIndex));
			elem.appendChild(psgElem);
		}
	};

	return elem;
}