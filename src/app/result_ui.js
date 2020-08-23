import * as bible_ui from './bible_ui.js';
import {makeElem} from '../common/utils.js';

export function createElement({id} ={}) {
	let elem = document.createElement('div');
	if (id) elem.setAttribute('id', id);

	elem.showHtml = html => {
		elem.innerHTML = html;
	};
	elem.show = results => {
		let hitCount = results.passages.reduce((n, p) => n + p.hits.length, 0);
		elem.innerHTML =
			`<b>Found ${hitCount} hits in ${results.passages.length} passages</b><br/><br/>`;
		
		let maxPassageCount = 500;
		let maxHitCount = 100;
		for (let psg of results.passages.slice(0, maxPassageCount)) {
			let psgElem = bible_ui.createElement();
			psgElem.showTokensAndSurrounding(
				psg.book,
				psg.hits.map(h => h.tokenIndex),
				{maxTkis: maxHitCount});
			elem.appendChild(psgElem);
			psgElem.highlightHits(psg.hits.slice(0, maxHitCount));
		}
		let remaining = results.passages.length - maxPassageCount;
		if (remaining > 0) {
			elem.appendChild(makeElem(`<div><div>&nbsp;</div><i>Not showing an additional ${remaining} passages</i></div>`));
		}
	};

	return elem;
}