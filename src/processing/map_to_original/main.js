import * as books from '../../common/books.js';
import * as bibles from '../../common/bibles.js';
import * as refs from '../../common/refs.js';
import {exportDebug, makeElem, onLoad, setIfUnset} from '../../common/utils.js';
import * as mapToOriginal from './map_to_original.js';

exportDebug('mapToOriginal', mapToOriginal);

let g_bodyElem;
let g_bible;
/* 
Map of strongs (and groups of strongs) to their translations across all Bible translations.
Example:
{
	"H1": {
		"translations": {
			"beginning": {
				"kjv": {
					"refs": ["ge1:1", "ge1:1", "ge2:5"],
					"count": 3,
				},
				"esv": {
					"count": 2,
				},
			},
		},
		"sequenceTranslations": {
			"H3": {
				"translations": {
					"in the beginning": {
						"kjv": {
							"refs": ["ge1:1"],
							"count": 1,
						},
					},
				},
				"sequenceTranslations": {
					"H2": {...}
				},
			},
		},
	},
	// ...
}
*/
let g_originalWordTranslationMap;
let g_wordCounts = {};

function pushView(name) {
	let url = new URL(document.URL);
	if (url.searchParams.get('view') == name)
		return;
	url.searchParams.set('view', name);
	history.pushState({}, '', url);
}

function viewByUrl() {
	let url = new URL(document.URL);
	let view = url.searchParams.get('view') || 'bible';
	if (view == 'bible') {
		viewBible();
		return;
	}
	let ref = refs.parse(view);
	if (ref.verse == -1) {
		viewBook(ref.book);
	} else {
		viewVerse(ref);
	}
}

function viewBible() {
	pushView('bible');

	function bkToNode(bkCode) {
		let bkElem = document.createElement('span');
		bkElem.innerText = books.codeToName[bkCode];
		bkElem.classList.add('link');
		bkElem.addEventListener('click', e => {
			viewBook(bkCode);
		});
		return bkElem;
	}
	let otElem = document.createElement('div');
	books.ot.forEach(bkCode => otElem.append(bkToNode(bkCode), document.createElement('br')));
	let ntElem = document.createElement('div');
	books.nt.forEach(bkCode => ntElem.append(bkToNode(bkCode), document.createElement('br')));

	let elem = document.createElement('div');
	elem.style.display = 'flex';
	elem.style.justifyContent = 'space-around';
	elem.append(otElem, ntElem);

	g_bodyElem.innerHTML = '';
	g_bodyElem.append(elem);
}

function viewBook(bkCode) {
	pushView(bkCode);

	let chapterToVerses = {};
	for (let [chapterAndVerse, v] of Object.entries(g_bible[bkCode])) {
		let [chNum, vNum] = chapterAndVerse.split(':');
		setIfUnset(chapterToVerses, chNum, {})[vNum] = v;
	}

	let bkElem = document.createElement('div');
	bkElem.style.display = 'grid';
	bkElem.style.columnGap = '1rem';
	bkElem.style.rowGap = '3rem';
	bkElem.style.padding = '2rem';
	bkElem.style.gridTemplateColumns = 'auto auto';
	for (let [chNum, vNumToVerse] of Object.entries(chapterToVerses)) {
		let chElem = document.createElement('span');
		chElem.innerText = 'Chapter ' + chNum;

		let chVersesElem = document.createElement('div');
		chVersesElem.classList.add('verse-block');
		for (let [vNum, v] of Object.entries(vNumToVerse)) {
			let vElem = document.createElement('span');
			vElem.classList.add('link');
			let h = vNum;
			let ref = refs.parse(bkCode + chNum + ':' + vNum);
			let problems = getProblems(g_bible[ref.book][ref.chapterAndVerse]);
			if (problems.length) {
				h += ` <sup style="font-size:.6rem;color:gray;">[${problems.length}]</sup>`;
			}
			vElem.innerHTML = h;
			vElem.addEventListener('click', e => {
				viewVerse(ref);
			});
			chVersesElem.append(vElem);
		}

		bkElem.append(chElem, chVersesElem);
	}

	g_bodyElem.innerHTML = '';
	g_bodyElem.append(bkElem);
}

function getProblems(v) {
	let mapped = v.map.map(([transTkis, origTkis]) => origTkis).flat().sort((a, b) => a - b);
	let problems = [];
	let mi = 0;
	let tki = 0;
	while (tki < v.originalTks.length) {
		if (tki === mapped[mi])
			mi++;
		else
			problems.push(tki);
		tki++;
	}
	return problems;
}

function viewVerse(ref) {
	pushView(ref.toString());

	let v = g_bible[ref.book][ref.chapterAndVerse];

	let newElem = makeVerseMapElement('lsv', makeVerseRows(v));
	let similarElems = Object.entries(v.similar).map(([name, v]) => makeVerseMapElement(name, makeVerseRows(v)));

	let elem = document.createElement('div');
	elem.style.display = 'flex';
	elem.append(newElem, ...similarElems);
	g_bodyElem.innerHTML = '';
	g_bodyElem.append(elem);
}

function makeVerseRows(v) {
	let rows = [];

	let mapped = Array.from(Array(v.originalTks.length), () => false);
	for (let mapping of v.map || []) {
		mapping[1].forEach(wi => mapped[wi] = true);
	}

	for (let wi = 0; wi < (v.translationTks || []).length;) {
		let [submapping, mi] = getSubmappingStartingWith(v.translationTks, v.map, wi);
		let endWi;
		if (submapping) {
			endWi = wi + submapping[0].length;
		} else {
			endWi = wi + 1;
			while (endWi < v.translationTks.length) {
				let nextSubmapping = getSubmappingStartingWith(v.translationTks[endWi], v.map, endWi)[0];
				if (nextSubmapping)
					break;
				endWi++;
			}
		}

		let row = {
			translation: v.translationTks.slice(wi, endWi).map(tk => tk['word']).join(' '),
		};
		if (submapping) {
			row.original = submapping[1].map(wi => v.originalTks[wi]['strong']).join(' ');
			let endOwi = submapping[1].slice(-1)[0] + 1;
			let originals = [];
			for (let owi = 0; owi < endOwi; owi++) {
				if (mapped[owi]) continue;
				mapped[owi] = true;

				originals.push(v.originalTks[owi]['strong']);
			}
			if (originals.length) rows.push({original: originals.join(' ')});
		}
		rows.push(row);

		wi = endWi;
	}

	let originals = [];
	for (let owi = 0; owi < v.originalTks.length; owi++) {
		if (mapped[owi]) continue;
		originals.push(v.originalTks[owi]['strong']);
	}
	if (originals.length) {
		if (!rows.length) {
			rows = originals.map(o => {return {original: o}});
		} else {
			rows.push({original: originals.join(' ')});
		}
	}

	return rows;
}

function getSubmappingStartingWith(tks, map, wi) {
	for (let [mi, mapping] of Object.entries(map)) {
		let startLeftI = mapping[0].indexOf(wi);
		if (startLeftI == -1) continue;

		let endLeftI = startLeftI + 1;
		while (endLeftI < mapping[0].length && mapping[0][endLeftI] == mapping[0][endLeftI - 1] + 1) {
			endLeftI++;
		}
		return [
			[mapping[0].slice(startLeftI, endLeftI), mapping[1]],
			mi,
		];
	}
	return [undefined, -1];
}

function makeVerseMapElement(name, rows) {
	let elem = document.createElement('div');
	elem.style.display = 'grid';
	let columnCount = (rows.some(r => r.translation) ? 1 : 0) + 1;
	elem.style.gridTemplateColumns = `repeat(${columnCount}, minmax(min-content, max-content))`;
	elem.style.padding = '1rem';
	elem.style.maxWidth = '20rem';

	if (columnCount == 2)
		elem.append(makeElem(`<b class="entry">${name}</b>`));
	elem.append(makeElem(`<b class="entry">${name} original</b>`));
	
	for (let [ri, row] of Object.entries(rows)) {
		if (columnCount == 2) {
			let transElem = document.createElement('span');
			transElem.classList.add('entry');
			elem.append(transElem);
			if (row.translation) {
				transElem.innerText = row.translation;
			}
		}

		let origElem = document.createElement('span');
		origElem.classList.add('entry');
		if (columnCount == 2) {
			origElem.style.borderLeft = '1px dashed black';
			if (row.original && !row.translation) {
				origElem.style.backgroundColor = '#fdd';
			}
		}
		elem.append(origElem);
		if (row.original) {
			origElem.innerText = row.original;
		}
	}

	return elem;
}

function convertMapFromWiToTki(bible) {
	let out = {};
	for (let bkCode in bible) {
		out[bkCode] = {};
		for (let [ref, v] of Object.entries(bible[bkCode])) {
			out[bkCode][ref] = v['map']
				.filter(([a, b]) => a.length && b.length)
				.map(([transWis, origWis]) => {
					let transTks = transWis.map(wi => v.translationTks[wi]);
					let origTks = origWis.map(wi => v.originalTks[wi]);
					return [
						transTks.map(tk => tk['tki']),
						origTks.map(tk => tk['tki']),
					];
				});
		}
	}
	return out;
}

function getOutput() {
	let namedBibles = bibles.verse.unmergeNamed(g_bible);
	let bookMap = JSON.stringify(
		bibles.verse.toBookTokenMap(
			convertMapFromWiToTki(g_bible),
			namedBibles['translation'],
			namedBibles['originalTks']),
		null,
		'\t')
			.replace(/\n\t{4}/g, '')
			.replace(/\n\t{3}/g, '')
			.replace(/\n\t{2}\]/g, ']');
	let originalTks =
		Object.fromEntries(Object.entries(namedBibles['originalTks']).map(([bkCode, bk]) => [
			bkCode,
			Object.fromEntries(Object.entries(bk).map(([ref, v]) => [
				ref,
				v.map(tk => { return {'strong': tk['strong']}}),
			]))
		]));
	let original = JSON.stringify(
		bibles.verse.toBookTokenBible(originalTks),
		null,
		'\t');
	return {
		map: bookMap,
		original: original,
	}
}

exportDebug('getOutput', getOutput);

onLoad.then(() => {
	g_bodyElem = document.getElementById('body');
	document.getElementById('back').addEventListener('click', e => {
		let url = new URL(document.URL);
		let view = url.searchParams.get('view') || 'bible';
		if (view == 'bible') return;
		let ref = refs.parse(view);
		if (ref.verse == -1) {
			viewBible();
		} else {
			viewBook(ref.book);
		}
	});
	document.getElementById('refresh').addEventListener('click', e => {
		viewByUrl();
	});

	let params = new URLSearchParams(location.search);
	if (!params.get('input')) {
		alert('Missing &input parameter');
		return;
	}
	fetch(params.get('input'))
		.then(r => r.json())
		.then(r => {
			g_bible = r['bible'];
			exportDebug('bible', g_bible);
			g_originalWordTranslationMap = r['originalWordTranslationMap'];
			exportDebug('originalWordTranslationMap', g_originalWordTranslationMap);
			Object.values(bibles.verse.flatten(r['bible'])).forEach(v =>
				v['translationTks'].forEach(
					tk => setIfUnset(g_wordCounts, tk['word'], 0)[tk['word']]++));
			exportDebug('wordCounts', g_wordCounts);
		})
		.then(viewByUrl);
});

window.onpopstate = viewByUrl;