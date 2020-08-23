import * as bibles from '../common/bibles.js';
import * as refs from '../common/refs.js';
import {ifDebug, Timer, exportDebug} from '../common/utils.js';
import * as resources from './resources.js';

/*
	The faster fixed layout does not work on some user agents:
		- iPhone 5s, iOS 12.4, Safari 12.1
		- iPhone X, iOS 13.5, Chrome 84

	It seems setting word-spacing to some specific values or some combination of word-spacing
	values causes some lines' font sizes to be very large.

	Just use the dynamic layout on iphone and disable interlinear support.
*/
export const doesSupportInterlinear = !navigator.userAgent.match(/iPhone/i);
export const doesSupportFixedLayout = doesSupportInterlinear;

export function createElement({id} = {}) {
	let elem = document.createElement('div');
	if (id) elem.setAttribute('id', id);
	elem.setAttribute('tabindex', 0);
	elem.toggleAttribute('data-has-history');

	let fixedHighlightsElem = document.createElement('div');
	fixedHighlightsElem.style.position = 'relative';
	elem.appendChild(fixedHighlightsElem);

	let interlinearParentElem = document.createElement('div');
	interlinearParentElem.style.position = 'relative';
	interlinearParentElem.style.top = '.825rem';
	elem.appendChild(interlinearParentElem);
	let interlinearElem = document.createElement('div');
	interlinearElem.style.position = 'absolute';
	interlinearElem.style.width = '0px';
	interlinearParentElem.appendChild(interlinearElem);

	let contentElem = document.createElement('div');
	elem.appendChild(contentElem);

	let spacingElem = document.createElement('div');
	spacingElem.style.minHeight = '70vh';

	let render;
	let highlight = {
		hits: [],
	};

	elem.show = function(refRange, {scrollToRef, interlinear = false} = {}) {
		ifDebug(() => {
			console.log('show', refRange.toString(), scrollToRef ? `scroll: ${scrollToRef}` : '')
		});

		if (!refRange.isWithinSingleBook() || !refRange.exists(resources.bible)) return false;
		if (scrollToRef && !scrollToRef.exists(resources.bible)) return false;

		if (!render || !render.fixedLayout) {
			contentElem.innerHTML = '<div style="width:2000px;"></div>';
		}
		let fixedWidth = contentElem.offsetWidth;
		let needsRenderDueToResize = render && render.fixedLayout && fixedWidth != render.width;
		if (!render || !refRange.equals(render.refRange) || needsRenderDueToResize) {
			let timer = new Timer();

			let bk = resources.bible[refRange.start.book];
			let limit = refRange.end.seek(resources.bible)
				? bk['refs'][refRange.end.seek(resources.bible).chapterAndVerse]
				: bk['tokens'].length;
			let tkiRange = [bk['refs'][refRange.start.chapterAndVerse], limit];

			render = {
				book: refRange.start.book,
				refRange: refRange,
				tkiRange: tkiRange,
			};
			let html;
			if (doesSupportFixedLayout) {
				let startTkiToLine;
				[html, startTkiToLine] = makeFixedLayout(bk, tkiRange, fixedWidth);
				Object.assign(render, {
					fixedLayout: true,
					width: fixedWidth,
					startTkiToLine: startTkiToLine,
					lineHeight: getContainerLineHeight(elem), 
				});
			} else {
				html = makeDynamicLayoutHtml(bk, tkiRange);
				Object.assign(render, {
					dynamicLayout: true,
				});
			}

			ifDebug(() => console.log('show [built]', refRange.toString(), timer.mark()));
			contentElem.innerHTML = html;
			ifDebug(() => console.log('show [parsed]', refRange.toString(), timer.mark()));

			elem.appendChild(spacingElem);

			if (highlight.hits.length) elem.highlightHits(highlight.hits);
			if (highlight.refRange) elem.highlightPassage(highlight.refRange);
			if (doesSupportInterlinear && interlinear) showInterlinear();
		}

		if (scrollToRef) {
			scrollTo(elem, elem.querySelector(`verse-num[name="${scrollToRef}"]`));
		}
		return true;
	};

	elem.setDoShowInterlinear = function(show) {
		if (!show) {
			interlinearElem.style.visibility = 'hidden';
			return;
		}

		showInterlinear();
	}

	function showInterlinear() {
		if (!render) return;
		if (!resources.onOriginalLoad) return;
		if (!render.fixedLayout) {
			throw new Error('Interlinear not supported with dynamic layout');
		}

		resources.onOriginalLoad.then(() => {
			if (!render || !render.tkiRange) return;
			if (!resources.bibleToOriginal[render.book].length) return;

			if (JSON.stringify(render.originalTkiRange) != JSON.stringify(render.tkiRange)) {
				let interlinearHtml = makeInterlinearFixedLayout(
					resources.bible[render.book],
					resources.bibleToOriginal[render.book],
					resources.original[render.book],
					contentElem.children,
					render.startTkiToLine,
					render.width,
					render.lineHeight);
				interlinearElem.innerHTML = interlinearHtml;
				render.originalTkiRange = render.tkiRange.concat();
			}
			interlinearElem.style.visibility = 'visible';
		});
	}

	elem.showTokensAndSurrounding = function(bkCode, tkis, {include = 7, maxTkis = 1e10} = {}) {
		if (!tkis.length) return false;

		let sortedTkis = tkis.sort((a, b) => a - b);
		let pairs = sortedTkis.slice(0, maxTkis).map(tki =>
			[
				bibles.seekTkiByWordCount(resources.bible[bkCode], tki, -include),
				bibles.seekTkiByWordCount(resources.bible[bkCode], tki, include),
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

		let refRange = refs.RefRange.containingTkis(resources.bible[bkCode], [sortedTkis[0], sortedTkis.slice(-1)[0]]);
		let refRangeHtml = `<a class="ref-range">${refRange}</a>`;

		let notIncludingHtml = '';
		if (tkis.length > maxTkis) {
			notIncludingHtml = `<i>not showing ${tkis.length - maxTkis} more hits...</i>`;
		}
		contentElem.innerHTML = refRangeHtml + '...' + collapsed
			.map(p => makeDynamicLayoutHtml(
				resources.bible[bkCode], p, {headings: false, verseNums: false}))
			.join('...') + '...' + notIncludingHtml;
		render = {
			book: refRange.start.book,
			dynamicLayout: true,
		};
		return true;
	};

	elem.highlightHits = function(hits) {
		highlight.hits = hits;
		if (!render) return;

		hits = hits.filter(h => h.book == render.book);
		if (render.dynamicLayout) {
			Array.from(elem.querySelectorAll('w.highlight'))
				.forEach(e => e.classList.remove('highlight'));
			hits.forEach(h => {
				let tokenElem = elem.getElemForToken(h.tokenIndex);
				if (tokenElem) tokenElem.classList.add('highlight');
			});
		} else {
			fixedHighlightsElem.innerHTML = '';
			let lineHeight = render.lineHeight;
			let childElems = contentElem.children;
			let li = 0;
			for (let h of hits) {
				if (h.tokenIndex < render.tkiRange[0])
					continue;
				if (h.tokenIndex >= render.tkiRange[1])
					break;
				let startTki;
				while (li < childElems.length) {
					startTki = parseInt(childElems[li].getAttribute('data-start-tki'));
					if (startTki != NaN && h.tokenIndex < startTki) {
						break;
					}
					li++;
				}
				while (!childElems[--li].hasAttribute('data-start-tki')) {}

				let y = li * lineHeight;
				let [x, width] = getLayoutInLine(resources.bible[render.book], childElems[li], h.tokenIndex);
				let wordElem = document.createElement('fixed-highlight');
				wordElem.style.top = y + 'px';
				wordElem.style.left = x + 'px';
				wordElem.style.width = width + 'px';
				fixedHighlightsElem.appendChild(wordElem);
			}
		}
	};

	elem.highlightPassage = function(refOrRange, permanent = true) {
		let refRange = refOrRange instanceof refs.Ref
			? new refs.RefRange(refOrRange, refOrRange) : refOrRange;
		if (!refRange.isWithinSingleBook() || !refRange.exists(resources.bible)) return false;

		if (permanent) highlight.refRange = refRange;
		else delete highlight.refRange;

		if (!render) return;

		Array.from(elem.querySelectorAll('verse-num.highlight, end-of-chapter.highlight'))
			.forEach(e => e.classList.remove('highlight'));
		Array.from(elem.querySelectorAll('verse-num.temp-highlight, end-of-chapter.temp-highlight'))
			.forEach(e => e.classList.remove('temp-highlight'));

		let highlightClass = permanent ? 'highlight' : 'temp-highlight';
		// Need to do this asynchronously so that removing and re-adding a temp-highlight works.
		window.setTimeout(() => {
			if (refRange.start.book == render.book) {
				let vElem = elem.getElemForVerseNum(refRange.start);
				if (vElem) vElem.classList.add(highlightClass);
			}
			if (refRange.end.book == render.book) {
				if (refRange.end.endsChapter(resources.bible)) {
					let eElem = elem.getElemForEndOfChapter(refRange.end.chapter);
					if (eElem) eElem.classList.add(highlightClass);
				} else {
					let vElem = elem.getElemForVerseNum(refRange.end.seek(resources.bible));
					if (vElem) vElem.classList.add(highlightClass);
				}
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

	let resizeTimeout;
	window.addEventListener('resize', e => {
		if (resizeTimeout) window.clearTimeout(resizeTimeout);

		resizeTimeout = window.setTimeout(() => {
			if (!render || !render.fixedLayout) return;
			elem.show(render.refRange);
		}, 1000);
	});
	return elem;
}

// TODO: Reimplement this in terms of flows.
function makeDynamicLayoutHtml(
		bk, [startTki, endTki],
		{headings = true, verseNums = true} = {}) {
	if (startTki < 0 || startTki >= bk['tokens'].length) throw new Error('invalid startTki');
	if (endTki < startTki || endTki > bk['tokens'].length) throw new Error('invalid endTki');

	let h = [];
	let bkRefs = Object.entries(bk['refs']);
	let ri = 0;
	for (; ri < bkRefs.length; ri++) {
		if (bkRefs[ri][1] >= startTki) {
			break;
		}
	}
	ri--;

	let isPsalm = bk['code'] == 'ps';

	for (let tki = startTki; tki < endTki; tki++) {
		if (ri < bkRefs.length - 1 && tki == bkRefs[ri+1][1]) {
			ri++;
			let ref = refs.parse(bk['code'] + bkRefs[ri][0]);

			// Add chapter/psalm heading.
			if (headings) {
				if (ri == 0 || ref.chapter != refs.parseChapter(bkRefs[ri-1][0])) {
					if (isPsalm) {
						if (ref.chapter != 1 && tki != startTki) {
							h.push(`<end-of-chapter name="${ref.chapter - 1}"></end-of-chapter>`);
						}
						h.push(`<psalm-num>PSALM ${ref.chapter}</psalm-num>`);
					} else {
						if (ref.chapter != 1 && tki != startTki)
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
					} else if (ref.verse != 1 || ri == 0 || refs.parseVerse(bkRefs[ri-1][0]) != 0) {
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
				h.push(`<line-break>||</line-break>`);
			}
		} else if ('punctuation' in tk) {
			h.push(tk['punctuation']);
		}
	}
	if (headings) {
		h.push(`<end-of-chapter name="${refs.parseChapter(bkRefs[ri][0])}"></end-of-chapter>`);
	}
	return h.join('');
}

const SPACE_WIDTH = 4.156;

/**
 * A flow is a layout element (either a block, paragraph, or line).
 *
 * Each flow consists of a list of flow tokens. These tokens are mostly the corresponding book
 * tokens supplemented with width and index information. Also, there are some non-book tokens,
 * e.g. the verse numbers. Also, space tokens are just converted to ' '.
 * 
 * Also, some entire flows may be inferred (e.g. chapter/psalm headings).
 *
 * This deviates from common/README.md, in that we automatically create a block per chapter
 * and merge line blocks into the chapter flow using the || (as the LSV has it).
 * TODO: Fix.
 */
function makeFlows(bk, [startTki, endTki], {headings = true, verseNums = true} = {}) {
	if (startTki < 0 || startTki >= bk['tokens'].length) throw new Error('invalid startTki');
	if (endTki < startTki || endTki > bk['tokens'].length) throw new Error('invalid endTki');

	let bkRefs = Object.entries(bk['refs']);
	let ri = 0;
	for (; ri < bkRefs.length; ri++) {
		if (bkRefs[ri][1] >= startTki) {
			break;
		}
	}
	ri--;

	let isPsalm = bk['code'] == 'ps';
	let flow = [];
	let flows = [flow];

	for (let tki = startTki; tki < endTki; tki++) {
		if (ri < bkRefs.length - 1 && tki == bkRefs[ri+1][1]) {
			ri++;
			let ref = refs.parse(bk['code'] + bkRefs[ri][0]);

			// Start of chapter/psalm:
			if (ri == 0 || ref.chapter != refs.parseChapter(bkRefs[ri-1][0])) {
				if (ref.chapter != 1 && tki != startTki) {
					flow.push({
						html: `<end-of-chapter name="${ref.chapter - 1}"></end-of-chapter>`,
						width: 0,
					});
				}

				if (flow.length == 0)
					flows.pop();

				if (headings) {
					if (tki != startTki) flows.push('<div>&nbsp;</div>');
					if (isPsalm)
						flows.push(`<psalm-num>PSALM ${ref.chapter}</psalm-num>`);
					else
						flows.push(`<chapter-num>CHAPTER ${ref.chapter}</chapter-num>`);
				}

				flow = [];
				flows.push(flow);
			}

			// Start of verse:
			if (verseNums) {
				if (isPsalm) {
					if (ref.verse == 0) {
						flow.push({
							html: `<verse-num name="${ref}"></verse-num><verse-num name="${ref.seek(resources.bible)}">1</verse-num>`,
							width: resources.textToWidth[1] * .8 + 1.6,
							tki: tki,
						});
					} else if (ref.verse != 1 || ri == 0 || refs.parseVerse(bkRefs[ri-1][0]) != 0) {
						flow.push({
							html: `<verse-num name="${ref}">${ref.verse}</verse-num>`,
							width: resources.textToWidth[ref.verse] * .7 + 1.6,
							tki: tki,
						});
					}
				} else {
					flow.push({
						html: `<verse-num name="${ref}">${ref.verse}</verse-num>`,
						width: resources.textToWidth[ref.verse] * .7 + 1.6,
						tki: tki,
					});
				}
			}
		}

		let tk = bk['tokens'][tki];
		let word = tk['word'];
		if (word) {
			flow.push({
				html: word,
				width: resources.textToWidth[word],
				tki: tki,
			});
			continue;
		}
		let layout = tk['layout'];
		if (layout) {
			if (tk['layout'] == 'space') {
				flow.push(' ');
			} else if ('newLine' in tk['layout']) {
				flow.push(' ');
				flow.push({
					html: '<line-break>||</line-break>',
					width: 11.23,
					tki: tki,
				});
				flow.push(' ');
			}
			continue;
		}
		let punc = tk['punctuation'];
		if (punc) {
			flow.push({
				html: punc,
				width: resources.textToWidth[punc],
				tki: tki,
			});
			continue;
		}
	}
	flow.push({
		html: `<end-of-chapter name="${refs.parseChapter(bkRefs[ri][0])}"></end-of-chapter>`,
		width: 0,
	});
	return flows;
}

// Returns a [html, startTkiToLine]
function makeFixedLayout(bk, [startTki, endTki], maxLineWidth) {
	let startTkiToLine = {};
	let flows = makeFlows(bk, [startTki, endTki]);

	function makeHtml(flow) {
		let lines = [];
		let line = {
			html: '',
			width: 0,
			spaces: 0,
			startTki: flow[0].tki,
			startFi: 0,
		};
		let nextAddition;

		function finishLine(endFi, skipJustify = false) {
			let extraSpacing = 0;
			if (!skipJustify) {
				let spaces = (line.spaces - (line.html.endsWith('&nbsp;') ? 1 : 0));
				let width = line.width + spaces * SPACE_WIDTH;
				extraSpacing = (maxLineWidth - width) / spaces;
			}
			lines.push(
				`<main-line data-start-tki="${line.startTki}" style="word-spacing:${extraSpacing.toFixed(2)}px">`
				+ line.html
				+ '</main-line>');
			startTkiToLine[line.startTki] = flow.slice(line.startFi, endFi);
		}

		function commitNext() {
			let over = line.width + line.spaces * SPACE_WIDTH + nextAddition.width - maxLineWidth;
			if (over > line.spaces * .1) {
				finishLine(nextAddition.startFi);
				line = {
					html: nextAddition.html,
					width: nextAddition.width,
					spaces: 0,
					startTki: nextAddition.startTki,
					startFi: nextAddition.startFi,
				};
				nextAddition = null;
			} else {
				line.html += nextAddition.html;
				line.width += nextAddition.width;
				nextAddition = null;
			}
		}

		for (let fi = 0; fi < flow.length; fi++) {
			let f = flow[fi];
			// Consider breaking:
			// TODO: break on hyphens? (would need to change highlighting too)
			if (f == ' ' || f.html == '—') {
				if (nextAddition)
					commitNext(fi);
			}

			// Add html:
			if (f != ' ') {
				if (!nextAddition) {
					nextAddition = {
						html: '',
						width: 0,
						startTki: f.tki,
						startFi: fi,
					};
				}
				nextAddition.html += f.html;
				nextAddition.width += f.width;
			} else {
				// Use non-breaking space so that selections involving multiple lines work.
				line.html += '&nbsp;';
				line.spaces++;
			}
		}

		if (nextAddition)
			commitNext();
		if (line.html.length)
			finishLine(flow.length, true);
		return lines.join('');
	}

	let h = [];
	for (let flow of flows) {
		if (typeof(flow) == 'string') {  // header
			h.push(flow);
			continue;
		}

		h.push(makeHtml(flow));
	}
	return [h.join(''), startTkiToLine];
}

function getLayoutInLine(bk, lineElem, tki) {
	let spaceWidth = SPACE_WIDTH + parseFloat(lineElem.style.wordSpacing);
	// Include tki in the requested flow, so that any verse number gets bundled with it.
	let flow = makeFlows(bk, [parseInt(lineElem.getAttribute('data-start-tki')), tki+1]).slice(-1)[0];
	// Remove any preceding space (brought in by a newLine token, a bit hacky).
	let start = (flow[0] == ' ') ? 1 : 0;
	// Remove the last two, which are the end of chapter mark and tki itself.
	let x = flow.slice(start, -2)
		.map(f => f.width !== undefined ? f.width : spaceWidth)
		.reduce((a, b) => a + b, 0);
	let width = resources.textToWidth[bk['tokens'][tki]['word']];
	return [x, width];
}

function makeInterlinearFixedLayout(
		mainBk,
		map,
		interlinearBk,
		lineElems,
		mainStartTkiToLine,
		maxLineWidth,
		lineHeight) {
	let mi = 0;
	let lang = interlinearBk['tokens'][0]['strong'][0] == 'H' ? 'hebrew' : 'greek';
	let toPxForLang = (lang == 'hebrew' ? .8125 : .6875);

	function line(flowTokens, extraSpacing) {
		let mappings = [];
		{
			let tkis = flowTokens.filter(ftk => ftk.tki !== undefined);
			let startTki = tkis[0].tki;
			let endTki = tkis.slice(-1)[0].tki;
			while (mi < map.length) {
				if (map[mi][0][0] >= startTki) {
					if (map[mi][0][0] > endTki) {
						break;
					}
					mappings.push(map[mi]);
				}
				mi++;
			}
			if (!mappings.length) {
				return '<br/>';
			}
		}

		let placements = getInterlinearPlacements(
			interlinearBk,
			mappings,
			getTkiToBoundsMap(flowTokens, SPACE_WIDTH, extraSpacing),
			toPxForLang);

		return `<interlinear-line class="${lang}">`
			+ placements.map(p => `<interlinear-word style="left:${p.relativeStartPosition}px" data-strong="${p.strong}">${p.text}</interlinear-word>`).join('')
			+ '</interlinear-line>';
	}

	let h = [];
	for (let lineElem of lineElems) {
		if (lineElem.hasAttribute('data-start-tki')) {
			let start = lineElem.getAttribute('data-start-tki');
			h.push(line(mainStartTkiToLine[start], parseFloat(lineElem.style.wordSpacing || 0)));
		} else {
			h.push('<br/>');
		}
	}
	return h.join('');
}

function getInterlinearPlacements(interlinearBk, mappings, mainTkiToBounds, toPxFactor) {
	let placements = [];

	let spaceWidth = SPACE_WIDTH * toPxFactor;
	let endPositionOfPrev = 0;
	let allPrevWidth = 0;
	for (let mapping of mappings) {
		let [mainTkis, intTkis] = mapping;
		let idealMiddlePosition;
		{
			let lastIndexOnLine = mainTkis.length - 1;
			while (!(mainTkis[lastIndexOnLine] in mainTkiToBounds)) {
				lastIndexOnLine--;
			}
			idealMiddlePosition = (mainTkiToBounds[mainTkis[0]][0] + mainTkiToBounds[mainTkis[lastIndexOnLine]][1]) / 2;
		}

		let layoutTks = intTkis.map(tki => {
			let tk = interlinearBk['tokens'][tki];
			let text = getInterlinearText(tk);
			let width = resources.textToWidth[text] * toPxFactor;
			if (isNaN(width)) {
				throw new Error('Unable to determine width of ' + text);
			}
			return {
				tk: tk,
				text: text,
				width: width,
			};
		});
		let totalWidth = layoutTks.reduce((a, b) => a + b.width, 0) + spaceWidth * (layoutTks.length - 1);
		let startPosition = idealMiddlePosition - totalWidth / 2;

		let extraSpaceToPrevious = startPosition - spaceWidth - endPositionOfPrev;
		if (extraSpaceToPrevious < 0) {
			// Divide the necessary space between the left and right.
			let shift = -extraSpaceToPrevious / 2;
			startPosition += shift;
			extraSpaceToPrevious = 0;

			// Shift left side further left:
			for (let pi = placements.length - 1; pi >= 0; pi--) {
				let p = placements[pi];
				if (shift <= p.extraSpaceToPrevious || pi == 0) {
					p.extraSpaceToPrevious -= shift;
					p.relativeStartPosition -= shift;
					shift = 0;
					break;
				} else {
					shift -= p.extraSpaceToPrevious;
					p.relativeStartPosition -= shift;
					p.extraSpaceToPrevious = 0;
				}
			}
		}
		endPositionOfPrev = startPosition + totalWidth;

		for (let layoutTk of layoutTks) {
			placements.push({
				text: layoutTk.text,
				strong: layoutTk.tk['strong'],
				relativeStartPosition: startPosition - allPrevWidth,
				extraSpaceToPrevious: extraSpaceToPrevious,
			});
			extraSpaceToPrevious = 0;

			startPosition += layoutTk.width + spaceWidth;
			allPrevWidth += layoutTk.width;
		}
	}

	return placements;
}

function getInterlinearText(tk) {
	let tuple = resources.strongs[tk['strong']];
	if (tuple) return tuple['lemma'];
	tuple = resources.strongs[tk['strong'] + 'a'];
	if (tuple) return tuple['lemma'];
	return '?';
}

function getTkiToBoundsMap(flowTokens, spaceWidth, extraWordSpacing) {
	let tkiToBounds = {};
	let position = 0;
	for (let ftk of flowTokens) {
		if (ftk == ' ') {
			position += spaceWidth + extraWordSpacing;
			continue;
		}

		if (ftk.tki !== undefined)
			tkiToBounds[ftk.tki] = [position, position + ftk.width];

		if (ftk.width) position += ftk.width;
	}
	return tkiToBounds;
}

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