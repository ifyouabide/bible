import * as books from '../common/books.js';
import {Ref, RefRange, orderBookTkiPairs} from '../common/refs.js';
import {setIfUnset} from '../common/utils.js';
import * as resources from './resources.js';

export const searchHelp = `
	<h3>Search Help</h3>
	<div style="margin-left:2rem;">
		Examples:
		<table>
			<tr><th>Description</th><th>Query</th></tr>
			<tr>
				<td>Passages containing 'faith'</td>
				<td><i>faith</i></td>
			</tr>
			<tr>
				<td>Passages containing 'faith' exactly (still case-insensitive)</td>
				<td><i>^faith$</i></td>
			</tr>
			<tr>
				<td>Passages in the gospels and Revelation containing 'faith'</td>
				<td><i>faith IN mt-jn re</i></td>
			</tr>
			<tr>
				<td>Passages containing 'faith' and 'fear'</td>
				<td><i>faith AND fear</i></td>
			</tr>
			<tr>
				<td>Passages containing ('faith' or 'trust') and 'fear'</td>
				<td><i>faith|trust AND fear</i></td>
			</tr>
		</table>
		<br/>
		Definition:
		<div style="margin-left:2rem;font-family:monospace;">
			<div>search : expression ['IN' ref-ranges]</div>
			<div>expression : word-matcher ['AND' expression]</div>
			<div>word-matcher : <a href="https://en.wikipedia.org/wiki/Regular_expression">regex</a></div>
			<div>ref-ranges : ref-range [ref-ranges]</div>
			<div>ref-range : book-code ['-' book-code] </div>
		</div>
		<br/>
		OT Book Codes:
		<div style="margin-left:2rem;">
			${books.codes.slice(0, 39).map(c => `<span>${c} </span>`).join('')}
		</div>
		NT Book Codes:
		<div style="margin-left:2rem;">
			${books.codes.slice(39).map(c => `<span>${c} </span>`).join('')}
		</div>
	</div>
`;

export function run(str) {
	let {matchers, unitRefRanges} = parseQuery(str);

	let out = {
		passages: [],
		hits: [],
	};
	for (let unitRefRange of unitRefRanges) {
		let unit = makeUnit(unitRefRange);
		let unitOut = search(unit, matchers);
		out.passages.push(...unitOut.passages);
		out.hits.push(...unitOut.hits);
	}
	out.hits.sort((a, b) => orderBookTkiPairs([a.book, a.tokenIndex], [b.book, b.tokenIndex]));
	return out;
}

function parseQuery(str) {
	let inParts = str.trim().split('IN').map(s => s.trim());
	if (inParts.length > 2) return;

	let refRanges = RefRange.parseMultiple(inParts.length == 2 ? inParts[1] : 'ge-re');
	if (!refRanges) return;
	let units = breakIntoBooks(refRanges);
	units = units.map(u => u.snapToExisting(resources.bible));

	let ands = inParts[0].split('AND').map(s => s.trim());
	let matchers = [];
	for (let and of ands) {
		let re = new RegExp(and, 'i');
		matchers.push((unit, tki) => {
			if ('word' in unit['tokens'][tki]) {
				return re.test(unit['tokens'][tki]['word']);
			}
			return false;
		});
	}

	return {
		matchers: matchers,
		unitRefRanges: units,
	};
}

function breakIntoBooks(refRanges) {
	let psalms = Array.from(Array(150), (_, i) => 'ps' + (i + 1));
	return refRanges
		.map(rr => {
			if (rr.start.book == rr.end.book) return rr;
			let inBetween = books.codes.slice(
				books.codes.indexOf(rr.start.book) + 1, books.codes.indexOf(rr.end.book));
			return [new RefRange(rr.start, Ref.parse(rr.start.book))]
				.concat(inBetween.map(RefRange.parse))
				.concat([new RefRange(Ref.parse(rr.end.book), rr.end)]);
		})
		.flat()
		.map(rr => {
			if (rr.start.book != 'ps' || rr.start.chapter == rr.end.chapter) return rr;
			let inBetween = psalms.slice(rr.start.chapter + 1, rr.end.chapter);
			return [new RefRange(rr.start, new Ref(rr.start.book, rr.start.chapter, -1))]
				.concat(inBetween.map(RefRange.parse))
				.concat([new RefRange(new Ref(rr.end.book, rr.end.chapter, -1), rr.end)]);
		})
		.flat();
}

function makeUnit(refRange) {
	let bk = resources.bible[refRange.start.book];
	let startTki = bk['refs'][refRange.start.chapterAndVerse];

	let refs = Object.keys(bk['refs']);
	let nextRef = refs[refs.indexOf(refRange.end.chapterAndVerse) + 1];
	let endTki = nextRef ? bk['refs'][nextRef] : bk['tokens'].length;

	let wi = 0;
	for (let tki = 0; tki < startTki; tki++) {
		if ('word' in bk['tokens'][tki]) wi++;
	}

	return {
		'code': bk.code,
		'tokens': bk['tokens'].slice(startTki, endTki),
		baseTokenIndex: startTki,
		baseWordIndex: wi,
	};
}

function search(unit, matchers, {pairDist = 30, groupDist = 150} = {}) {
	// Each hit is a {tokenIndex, wordIndex} object.
	let hitsPerMatcher = runMatchers(unit, matchers);

	// Each pairing is a list of hits (one per matcher).
	let pairings = pair(hitsPerMatcher, pairDist);

	// Each group/passage is a list of pairs within that group.
	let groups = group(
		pairings, groupDist,
		p => Math.max(...p.map(h => h.wordIndex)), p => Math.min(...p.map(h => h.wordIndex)));

	function supplementedHit(h) {
		h = Object.assign({book: unit['code']}, h);
		h.wordIndex += unit.baseWordIndex || 0;
		h.tokenIndex += unit.baseTokenIndex || 0;
		return h;
	}

	return {
		passages: groups.map(grp => {;
			return {
				hits: Array.from(
					new Set(grp.flat().map(supplementedHit).map(JSON.stringify))).map(JSON.parse),
				bounds: [
					grp.flat().sort((a, b) => a.tokenIndex - b.tokenIndex)[0],
					grp.flat().sort((a, b) => b.tokenIndex - a.tokenIndex)[0],
				],
				book: unit['code'],
			};
		}),
		hits: hitsPerMatcher.flat().map(supplementedHit),
	};
}

function runMatchers(unit, matchers) {
	let hits = [];
	matchers.forEach(m => hits.push([]));
	let wi = 0;
	for (let tki = 0; tki < unit['tokens'].length; tki++) {
		for (let mi in matchers) {
			if (matchers[mi](unit, tki)) {
				hits[mi].push({tokenIndex: tki, wordIndex: wi});
			}
		}
		if ('word' in unit['tokens'][tki]) wi++;
	}
	return hits;
}

function pair(hitsPerMatcher, pairDist) {
	let pairings = [];
	let hitIndices = [];
	hitsPerMatcher.forEach(m => hitIndices.push(0));
	while (true) {
		let done = false;
		for (let mi = 0; mi < hitsPerMatcher.length; mi++) {
			if (hitIndices[mi] >= hitsPerMatcher[mi].length) {
				done = true;
				break;
			}
		}
		if (done) { break; }

		let minMI = 0;
		let maxMI = 0;
		for (let mi = 1; mi < hitsPerMatcher.length; mi++) {
			let h = hitsPerMatcher[mi][hitIndices[mi]].wordIndex;
			let min = hitsPerMatcher[minMI][hitIndices[minMI]].wordIndex;
			if (h < min) {
				minMI = mi;
			}
			let max = hitsPerMatcher[maxMI][hitIndices[maxMI]].wordIndex;
			if (h > max) {
				maxMI = mi;
			}
		}
		if (Math.abs(hitsPerMatcher[minMI][hitIndices[minMI]].wordIndex - hitsPerMatcher[maxMI][hitIndices[maxMI]].wordIndex) <= pairDist) {
			let pairing = [];
			for (let mi = 0; mi < hitsPerMatcher.length; mi++) {
				pairing.push(hitsPerMatcher[mi][hitIndices[mi]]);
			}
			pairings.push(pairing);
		}

		// Not exhaustive.
		hitIndices[minMI] += 1;
	}
	return pairings;
}

function group(items, maxDist, getPos1 = a => a, getPos2 = a => a) {
	let groups = [];
	let groupStart = Infinity;
	for (let i = 0; i < items.length - 1; i++) {
		let cur = getPos1(items[i]);
		let next = getPos2(items[i+1]);
		if (Math.abs(cur - next) <= maxDist) {
			if (groupStart == Infinity) {
				groupStart = i;
			}
		} else {
			groups.push(items.slice(Math.min(groupStart, i), i+1));
			groupStart = Infinity;
		}
	}
	if (items.length > 0) {
		groups.push(items.slice(Math.min(groupStart, items.length - 1)));
	}
	return groups;
}