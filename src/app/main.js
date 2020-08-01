import * as bibleUi from './bible_ui.js';
import * as books from '../common/books.js';
import * as refs from '../common/refs.js';
import settings from '../common/settings.js';
import {$id, exportDebug, onLoad, client, makeElem} from '../common/utils.js';
import * as query from './query.js';
import * as resources from './resources.js';
import * as resultUi from './result_ui.js';

// This is now in index.html, but keep here until all mini users have updated.
document.head.appendChild(
	makeElem('<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Open+Sans">'));

let g_isDualPanel = client.isDesktop || window.innerWidth > 900;
let g_isBookReadScope = client.isDesktop || !client.isSmallScreen;
let g_hasZeroWidthScrollbars = (() => {
	let testElem = document.createElement('div');
	testElem.style.overflowY = 'scroll';
	testElem.style.maxWidth = '20px';
	testElem.innerText = '&nbsp; '.repeat(20);
	document.body.appendChild(testElem);
	let zeroWidth = testElem.offsetWidth == testElem.clientWidth;
	document.body.removeChild(testElem);
	return zeroWidth;
})();


let g_readPanel, g_bookElem;
{
	let basicInstructionsHtml = `
		To read the Bible, select a book from the top-left dropdown.
		To search the Bible, press the 'Search' button at the bottom.
	`;

	let introHtml = `
		<div
			id="intro"
			style="
				height:100%;
				padding-top:1.8rem;
				overflow-y:auto;
				border: 1.5px solid #aaa;">
			<center><h2>${settings.welcome}</h2></center>
			<div style="padding:1rem;">
				${basicInstructionsHtml}
				<br/>
				${settings.about}
			</div>
		</div>
	`;
	g_readPanel = makeElem(`
		<div
			id="readPanel"
			style="
				display: flex;
				flex-direction: column;
				height: 100%;
				max-width: 40rem;
				min-width: 20rem;
			">
			<div
				class="bar"
				style="
					justify-content:space-between;
					min-height:2rem;
					padding-left:2rem;
					padding-right:${g_hasZeroWidthScrollbars ? 2 : 3}rem;">
				<span style="width:8rem;" class="theme">
					<select id="bookSelect" style="height:2rem;width:4rem;">
						<option>Book</option>
						${books.codes
							.map(bk => `<option name="${bk}">${books.codeToName[bk]}</option>`)
							.join('')}
					</select>
					<span id="widthCalculator" style="visibility:hidden;position:absolute;"></span>
				</span>
				<a
					href="${settings.bibleLink}" rel="noopener" class="bible-title theme"
					style="padding-top:.3rem;">${settings.bible.toUpperCase()}
				</a>
				<span style="display:inline-block;width:8rem;">
					<input
						id="refInput" type="text" class="theme" maxlength="11"
						style="
							display:none;
							float:right;
							width:6rem;
							height:2rem;
							text-align:right;
						">
					<select
						id="chapterSelect"
						style="
							display:none;
							float:right;
							height:2rem;
						"></select>
					</span>
				</span>
			</div>
			${introHtml}
			<div 
				id="bottomReaderBar" class="bar"
				style="
					display:none;
					padding-top:.3rem;
					height:1.7rem;
					padding-left:2rem;
					padding-right:${g_hasZeroWidthScrollbars ? 2 : 3}rem;">
				<span id="prevChapterButton" class="button" style="visibility:hidden;">
					<<
				</span>
				<span style="flex-grow:1;text-align:center;">
					<span id="openSearchButton" class="button">
						Search
					</span>
				</span>
				<span id="nextChapterButton" class="button" style="visibility:hidden;">
					>>
				</span>
			</div>
		</div>
	`);

	function id(idStr) {
		return g_readPanel.querySelector('#' + idStr);
	}

	// Book select:
	{
		id('bookSelect').children[0].disabled = true;
		id('bookSelect').addEventListener('change', e => {
			read(e.target.children[e.target.selectedIndex].getAttribute('name'));
		}, false);
	}

	if (g_isBookReadScope) {
		// Reference input:
		let refInput = id('refInput');
		refInput.style.display = '';
		refInput.addEventListener('input', e => {
			read(e.target.value, {skipFocus: true, highlightPassageTemporarily: true});
		});
		refInput.addEventListener('keydown', e => {
			if (e.key == 'Enter') {
				g_bookElem.focus();
			}
		});
		window.addEventListener('keydown', e => {
			if (!isEditing() && e.key == '/') {
				refInput.focus();
				refInput.select();
				e.preventDefault();
			}
		});
	} else {
		// Chapter select:
		id('chapterSelect').style.display = '';
		id('chapterSelect').addEventListener('change', e => {
			read(e.target.children[e.target.selectedIndex].getAttribute('name'));
		});
	}

	// Bottom bar:
	{
		id('bottomReaderBar').style.display = 'flex';
		id('prevChapterButton').addEventListener('click', e => {
			if (g_isBookReadScope) {
				read(seekChapter(-1));
			} else {
				read(e.target.getAttribute('name'));
			}
		});
		id('nextChapterButton').addEventListener('click', e => {
			if (g_isBookReadScope) {
				read(seekChapter(1));
			} else {
				read(e.target.getAttribute('name'));
			}
		});	
		id('openSearchButton').addEventListener('click', e => {
			openSearch();
		});
	}

	g_bookElem = bibleUi.createElement({id: 'book'});
	g_bookElem.style.display = 'none';
	g_readPanel.insertBefore(g_bookElem, g_readPanel.lastElementChild);
	let startingRef = new URLSearchParams(location.search).get('ref');
	if (startingRef) {
		resources.onLoad.then(() => {
			read(resources.startingRef, {highlightPassageTemporarily: true});
			g_readPanel.style.display = 'flex';
		});
	} else {
		g_readPanel.style.display = 'flex';
	}
}

function isChapterHeadingVisible(num = 0) {
	let scroll = g_bookElem.scrollTop;
	for (let elem of g_bookElem.querySelectorAll('chapter-num, psalm-num')) {
		if (elem.offsetTop - scroll > g_bookElem.offsetHeight) break;
		if (elem.offsetTop - scroll > 32) {
			if (num == 0 || parseInt(elem.innerText.split(' ')[1]) == num)
				return true;
		}
	}
	return false;
}

function getCurrentChapter() {
	let scroll = g_bookElem.scrollTop;
	let lastCh;
	for (let elem of g_bookElem.querySelectorAll('chapter-num, psalm-num')) {
		if (elem.offsetTop - scroll > g_bookElem.offsetHeight / 2) break;

		lastCh = parseInt(elem.innerText.split(' ')[1]);
	}
	if (!lastCh) return;
	
	let book = refs.parseBook(g_bookElem.querySelector('verse-num').getAttribute('name'));
	return refs.parse(book + lastCh);
}

function getFirstVisibleRef() {
	let scroll = g_bookElem.scrollTop;
	for (let elem of g_bookElem.querySelectorAll('verse-num')) {
		if (elem.offsetTop - scroll - 32 > 0) {
			return refs.parse(elem.getAttribute('name'));
		}
	}
}

function seekChapter(dir = 1) {
	let ref = getCurrentChapter();
	if (!ref) return;

	let isHeadingVisible = isChapterHeadingVisible(ref.chapter);
	if (dir == -1) {
		if (isHeadingVisible)
			return ref.book + ((ref.chapter - 1) || 1) + ':1';
		return ref.book + ref.chapter + ':1';
	}
	return ref.book + Math.min(ref.chapter + 1, refs.getChapterCount(resources.bible[ref.book])) + ':1';
}

function read(str, {highlightPassageTemporarily = false, highlightPassagePermanently = false, skipFocus = false} = {}) {
	let refRange = refs.parseRange(str);
	if (!refRange) return false;

	g_bookElem.style.display = '';

	if (!g_isDualPanel) {
		g_readPanel.style.display = 'flex';
		g_searchPanel.style.display = 'none';
	}
	$id('intro').style.display = 'none';

	refRange = refRange.limitToSingleBook().snapToExisting(resources.bible);

	let readRange = refs.parseRange(
		g_isBookReadScope ? refRange.start.book : (refRange.start.book + refRange.start.chapter + ':'))
			.snapToExisting(resources.bible);

	if (g_bookElem.show(readRange, {scrollToRef: refRange.start})) {
		if (highlightPassageTemporarily || highlightPassagePermanently)
			g_bookElem.highlightPassage(
				str.indexOf('-') != -1 ? refRange : refRange.start, highlightPassagePermanently);

		$id('bookSelect').selectedIndex = books.codes.indexOf(refRange.start.book) + 1;
		$id('widthCalculator').innerText = books.codeToName[refRange.start.book];
		// Adding 12 for safari, 12 for the arrow.
		let round = x => Math.round(x / 5) * 5;
		$id('bookSelect').style.width = round(parseInt($id('widthCalculator').offsetWidth) + 12 + 12) + 'px';

		if (g_isBookReadScope) {
			if ($id('refInput') != document.activeElement) {
				$id('refInput').value = refRange.start.toString();
			}
			$id('prevChapterButton').style.visibility = (readRange.end.chapter > 1)
				? 'visible' : 'hidden';
			$id('nextChapterButton').style.visibility = (readRange.end.chapter > 1)
				? 'visible' : 'hidden';
		} else {
			let chapterCount = refs.getChapterCount(resources.bible[readRange.start.book]);
			$id('chapterSelect').innerHTML = Array.from(Array(chapterCount), (_, i) => i + 1)
				.map(ch => `<option name="${readRange.start.book}${ch}">${ch}</option>`)
				.join('');
			$id('chapterSelect').selectedIndex = readRange.start.chapter - 1;
			$id('prevChapterButton').style.visibility = (readRange.start.chapter > 1)
				? 'visible' : 'hidden';
			$id('prevChapterButton').setAttribute('name', readRange.start.book + (readRange.start.chapter - 1));
			$id('nextChapterButton').style.visibility = (readRange.end.chapter < chapterCount)
				? 'visible' : 'hidden';
			$id('nextChapterButton').setAttribute('name', readRange.start.book + (readRange.start.chapter + 1));
		}

		if (!skipFocus) g_bookElem.focus();
		return true;
	}
	return false;
}

let g_searchPanel, g_resultElem;
{
	g_searchPanel = makeElem(`
		<div
			id="searchPanel"
			style="
				display: none;
				flex-direction: column;
				flex-grow: 1;
				flex-shrink: 100;
				height: 100%;
			">
			<div style="display:flex;">
				<input id="helpButton" type="button" value="Help">
				<input id="clearButton" type="button" value="Clear">
				<textarea id="searchBox" rows="2" style="flex-grow:1;resize:vertical;"></textarea>
				<input id="searchButton" type="button" value="Search">
			</div>
		</div>
	`);

	let shortcutHelp = `
		<h3>Shortcuts</h3>
		<div style="margin-left:2rem;">
			<table>
				<tr><td>Focus the reference box</td><td><i>/</i></td></tr>
				<tr><td>Focus the search box</td><td><i>?</i></td></tr>
				<tr><td>Perform a search</td><td><i>shift+Enter</i> (when the search box is focused)</td></tr>
			</table>
		</div>
	`;

	let help = `
		<div style="max-width:600px;">
			${query.searchHelp}
			${shortcutHelp}
		</div>
	`;

	function id(idStr) {
		return g_searchPanel.querySelector('#' + idStr);
	}

	g_resultElem = resultUi.createElement({id: 'resultPanel'});
	g_searchPanel.insertBefore(g_resultElem, g_searchPanel.firstChild);

	if (!g_isDualPanel) {
		let topBar = makeElem(`
			<div class="top-bar" style="justify-content:center;padding-top:.3rem;height:1.7rem;">
				<span id="back">
					Back
				</span>
			</div>
		`);
		topBar.querySelector('#back').addEventListener('click', e => {
			g_readPanel.style.display = 'flex';
			g_searchPanel.style.display = 'none';
		});
		g_searchPanel.insertBefore(topBar, g_searchPanel.firstChild);
	}

	id('helpButton').addEventListener('click', () => g_resultElem.showHtml(help));
	id('clearButton').addEventListener('click', () => {
		g_results = null;
		g_resultElem.showHtml('');
		g_bookElem.highlightHits([]);
	});

	id('searchButton').addEventListener('click', runQuery);
	id('searchBox').addEventListener('keydown', e => {
		if (e.shiftKey && e.key == 'Enter') {
			runQuery();
			e.stopPropagation();
			e.preventDefault();
		}
	});
	window.addEventListener('keyup', e => {
		if (!isEditing() && e.key == '?') {
			openSearch();
		}
	});

	window.addEventListener('click', e => {
		if (e.target.classList.contains('ref-range')) {
			read(e.target.innerText, {highlightPassagePermanently: true});	
		}
	});
}

function openSearch() {
	if (!g_isDualPanel)
		g_readPanel.style.display = 'none';
	
	g_searchPanel.style.display = 'flex';
	if (g_isDualPanel) {
		$id('searchBox').focus();
		$id('searchBox').select();
	}
}

let g_results;
function runQuery() {
	g_results = query.run($id('searchBox').value);
	if (!g_results) return;
	g_resultElem.show(g_results);
	g_bookElem.highlightHits(g_results.hits);
}

function isEditing() {
	return new Set(['INPUT', 'TEXTAREA']).has(document.activeElement.tagName);
}

onLoad().then(() => {
	document.body.appendChild(g_readPanel);
	document.body.appendChild(g_searchPanel);
});

exportDebug('bibleUi', bibleUi);
exportDebug('query', query);
exportDebug('refs', refs);
exportDebug('resources', resources);
exportDebug('settings', settings);