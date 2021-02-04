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
document.head.appendChild(
	makeElem('<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Source+Sans+Pro">'));
document.head.appendChild(
	makeElem('<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Cardo">'));

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
let g_popups = [];
let g_doShowInterlinear = false;

let g_noAppearanceStyle = `
	appearance: none;
	-webkit-appearance: none;
	-moz-appearance: none;
`;

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
				padding-left:2rem;
				padding-right:2rem;
				overflow-y:auto;
				-webkit-overflow-scrolling: touch;
				border: 1.5px solid #aaa;">
			<center><h2>${settings.welcome}</h2></center>
			<div>
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
					padding-top:.5rem;
					padding-bottom:.5rem;
					padding-left:1rem;
					padding-right:${g_hasZeroWidthScrollbars ? 1 : 2}rem;
					${window.innerWidth < 360 ? 'font-size:.8rem;' : ''}
					">
				<span style="flex-basis:9rem;">	
					<span id="bookAndChapterMenuButton" class="button theme">
						Select Book
						<svg style="width:1rem;height:.9rem;stroke-width:.1rem;fill:none;">
						  <polyline points="4 7 8 11 12 7"/>
						</svg>
					</span>
				</span>
				<a href="${settings.bibleLink}" rel="noopener" class="bible-title theme">
					${settings.bible.toUpperCase()}
				</a>
				<span style="flex-basis:9rem;">
					<span id="menuButton" class="button theme" style="float:right;">
						Menu
					</span>
				</span>
			</div>
			<div style="position:relative;">
				<div
					id="bookAndChapterMenuPanel"
					class="menu"
					style="display:none;">
				</div>
			</div>
			<div style="position:relative;">
				<div
					id="menuPanel"
					class="menu"
					style="display:none;">
				</div>
			</div>
			<div style="position:relative;">
				<div id="goToMenuPanel" class="menu" style="display:none;overflow-y:hidden;">
					<input id="goToInput" type="text" maxlength="20" style="padding:.25rem 1rem;">
				</div>
			</div>
			${introHtml}
			<div 
				id="bottomReaderBar" class="bar"
				style="
					display:none;
					padding-top:.3rem;
					height:1.7rem;
					padding-left:1rem;
					padding-right:${g_hasZeroWidthScrollbars ? 1 : 2}rem;">
				<span id="prevChapterButton" class="button theme" style="visibility:hidden;">
					<<
				</span>
				<span style="flex-grow:1;text-align:center;">
					<span id="openSearchButton" class="button theme">
						Search
					</span>
				</span>
				<span id="nextChapterButton" class="button theme" style="visibility:hidden;">
					>>
				</span>
			</div>
		</div>
	`);

	function id(idStr) {
		return g_readPanel.querySelector('#' + idStr);
	}

	// Book/chapter select menu:
	{
		let menuPanel = id('bookAndChapterMenuPanel');
		registerPopup(menuPanel);
		menuPanel.style.gridTemplateColumns = '1fr';

		function bookSelectButton(bkCode) {
			let elem = makeElem(`
				<div class="book-select-button">${books.codeToName[bkCode]}</div>`);
			elem.addEventListener('click', e => {
				if (books.codeToChapterCount[bkCode] == 1) {
					menuPanel.style.display = 'none';
					read(bkCode + '1');
				} else {
					elem.nextSibling.style.display = (elem.nextSibling.style.display == 'none' ? 'grid' : 'none');
					elem.nextSibling.scrollIntoViewIfNeeded();
				}
			});
			return elem;
		}
		let ri = 0;
		menuPanel.append(
			makeElem('<div class="book-select-header">Old Testament</div>'));
		for (let bkCode of books.codes) {
			if (bkCode == 'mt') {
				menuPanel.append(makeElem('<div class="book-select-header">New Testament</div>'));
			}
			let bkButton = bookSelectButton(bkCode);

			let chs = Array.from(Array(books.codeToChapterCount[bkCode]), (_, i) => i + 1);
			let versesGrid = makeElem(`
				<div class="chapter-select-grid" style="display:none;">
					${chs.map(ch => '<span class="chapter-select-button">' + ch + '</span>').join('')}
				</div>
			`);
			versesGrid.addEventListener('click', e => {
				menuPanel.style.display = 'none';
				read(bkCode + e.target.innerText);
			});

			menuPanel.append(bkButton, versesGrid);
		}

		id('bookAndChapterMenuButton').addEventListener('click', e => {
			let wasClosed = menuPanel.style.display == 'none';
			closePopups();
			if (wasClosed) {
				e.stopPropagation();
				menuPanel.style.display = 'grid';
				let bookSelectButton = Array.from(menuPanel.querySelectorAll('.book-select-button'))
					.find(button => button.innerText == e.target.innerText);
				Array.from(menuPanel.querySelectorAll('.chapter-select-grid'))
					.forEach(grid => {
						let shouldShow = grid.previousSibling == bookSelectButton
							&& grid.childElementCount > 1;
						grid.style.display = (shouldShow ? 'grid' : 'none');
					});
				if (bookSelectButton) {
					bookSelectButton.scrollIntoView();
				}
			}
		});
	}

	// Main menu:
	{
		let menuPanel = id('menuPanel');
		registerPopup(menuPanel);
		menuPanel.style.right = (2 + g_hasZeroWidthScrollbars ? 1 : 0) + 'rem';

		let searchButton = makeElem(`<div class="menu-option menu-option-button">Search<span style="float:right;">?<span></div>`);
		searchButton.addEventListener('click', e => {openSearch(); closePopups();});
		
		let goToButton = makeElem(`<div class="menu-option menu-option-button">Go To<span style="float:right;">/<span></div>`);
		goToButton.addEventListener('click', e => {openGoTo();});
		window.addEventListener('keypress', e => {
			if (isEditing()) return;
			if (e.key == '/') {
				openGoTo();
				e.preventDefault();  // Firefox opens a quick find otherwise.
			}
		});

		let nextChButton = makeElem(`<div class="menu-option menu-option-button">Next Chapter<span style="float:right;">n<span></div>`);
		nextChButton.addEventListener('click', e => {goToNextChapter(1); closePopups();});
		let prevChButton = makeElem(`<div class="menu-option menu-option-button">Previous Chapter<span style="margin-left:1rem;float:right;">p<span></div>`);
		prevChButton.addEventListener('click', e => {goToNextChapter(-1); closePopups();});
		menuPanel.append(
			searchButton,
			makeElem('<hr>'),
			goToButton,
			nextChButton,
			prevChButton,
			makeElem('<hr>'));
		if (settings.original && bibleUi.doesSupportInterlinear) {
			let interlinearSelect = makeElem(`
				<select style="font-size:.7rem;margin-right:1rem;">
					<option>None</option>
					<option>Greek Lemma (NT)</option>
				</select>
			`);
			interlinearSelect.addEventListener('change', e => {
				g_doShowInterlinear = (e.target.selectedIndex == 1);
				g_bookElem.setDoShowInterlinear(g_doShowInterlinear);
			});
			window.addEventListener('keypress', e => {
				if (isEditing()) return;
				if (e.key == 'i') {
					g_doShowInterlinear = !g_doShowInterlinear;
					interlinearSelect.selectedIndex = (g_doShowInterlinear ? 1 : 0);
					g_bookElem.setDoShowInterlinear(g_doShowInterlinear);
				} 
			});
			let interlinearElem = makeElem('<div class="menu-option"></div>');
			interlinearElem.append(
				makeElem('<span>Interlinear:</span>'),
				interlinearSelect,
				makeElem('<span style="float:right;padding-right:.2rem;">i<span>'));
			menuPanel.append(
				interlinearElem,
				makeElem('<hr>'));
		}
		let aboutButton = makeElem(`<div class="menu-option menu-option-button">About</div>`);
		aboutButton.addEventListener('click', e => {openAbout(); closePopups();});
		menuPanel.append(aboutButton);

		id('menuButton').addEventListener('click', e => {
			let wasClosed = menuPanel.style.display == 'none';
			closePopups();
			if (wasClosed) {
				menuPanel.style.display = '';
				e.stopPropagation();
			}
		});
	}

	// GoTo menu panel:
	{
		let menuPanel = id('goToMenuPanel');
		registerPopup(menuPanel);
		let goToInput = id('goToInput');
		goToInput.addEventListener('input', e => {
			resources.onParserLoad.then(() => {
				goTo(e.target.value);
			});
		});
		goToInput.addEventListener('keydown', e => {
			if (e.key == 'Enter') {
				goTo(e.target.value);
			}
			if (e.key == 'Enter' || e.key == 'Escape') {
				closePopups();
				g_bookElem.focus();
			}
		});
		function goTo(str) {
			let parser = new bcv_parser();
			parser.set_options({
				'versification_system': 'kjv',
				'passage_existence_strategy': 'b',
				'book_alone_strategy': 'first_chapter',
			});
			parser.parse(str);
			let osisRef = parser.osis();
			if (osisRef) {
				let osisBk = osisRef.split('.', 1)[0];
				let ref = books.osisToCode[osisBk] + osisRef.slice(osisBk.length + 1).replace('.', ':');
				let specificVerse = refs.parse(ref).verse != -1;
				read(ref, {skipFocus: true, highlightPassageTemporarily: specificVerse});
			}
		}
	}

	// Bottom bar:
	{
		id('bottomReaderBar').style.display = 'flex';
		id('prevChapterButton').addEventListener('click', e => goToNextChapter(-1));
		id('nextChapterButton').addEventListener('click', e => goToNextChapter(1));
		window.addEventListener('keypress', e => {
			if (isEditing()) return;

			if (e.key == 'p') {
				goToNextChapter(-1)
			} else if (e.key == 'n') {
				goToNextChapter(1);
			}
		});

		id('openSearchButton').addEventListener('click', e => openSearch());
		window.addEventListener('keyup', e => {
			if (isEditing()) return;

			if (e.key == '?') openSearch();
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

function goToNextChapter(dir) {
	let ref = getNextChapter(dir);
	if (ref) read(ref);
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

function getNextChapter(dir = 1) {
	let ref = getCurrentChapter();
	if (!ref) return;

	function get() {
		if (!g_isBookReadScope) {
			return ref.book + Math.min(Math.max(1, ref.chapter + dir), books.codeToChapterCount[ref.book]);
		}

		let isHeadingVisible = isChapterHeadingVisible(ref.chapter);
		if (dir == -1) {
			if (isHeadingVisible)
				return ref.book + ((ref.chapter - 1) || 1);
			return ref.book + ref.chapter;
		}
		return ref.book + Math.min(ref.chapter + 1, books.codeToChapterCount[ref.book]);
	}
	let next = get();
	if (refs.parseChapter(next) == ref.chapter) {
		if (!g_isBookReadScope) return;
		if (dir == 1) return;
		if (dir == -1 && ref.chapter == 1) return;		
	}
	return next + ':1';
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

	if (g_bookElem.show(readRange, {scrollToRef: refRange.start, interlinear: g_doShowInterlinear})) {
		if (highlightPassageTemporarily || highlightPassagePermanently)
			g_bookElem.highlightPassage(
				str.indexOf('-') != -1 ? refRange : refRange.start, highlightPassagePermanently);

		$id('bookAndChapterMenuButton').innerText = books.codeToName[refRange.start.book];
		
		if (g_isBookReadScope) {
			$id('prevChapterButton').style.visibility = (readRange.end.chapter > 1)
				? 'visible' : 'hidden';
			$id('nextChapterButton').style.visibility = (readRange.end.chapter > 1)
				? 'visible' : 'hidden';
		} else {
			$id('prevChapterButton').style.visibility = (readRange.start.chapter > 1)
				? 'visible' : 'hidden';
			$id('nextChapterButton').style.visibility = (readRange.end.chapter < books.codeToChapterCount[refRange.start.book])
				? 'visible' : 'hidden';
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
				<textarea id="searchBox" rows="2" style="flex-grow:1;resize:vertical;"></textarea>
				<input id="searchButton" type="button" value="Search">
			</div>
		</div>
	`);

	let help = `
		<div style="max-width:600px;">
			${query.searchHelp}
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

	id('searchButton').addEventListener('click', runQuery);
	id('searchBox').addEventListener('keydown', e => {
		if (e.shiftKey && e.key == 'Enter') {
			runQuery();
			e.stopPropagation();
			e.preventDefault();
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
	g_resultElem.showHtml('searching...');
	g_results = query.run($id('searchBox').value);
	g_resultElem.show(g_results);
	g_bookElem.highlightHits(g_results.hits);
}

function isEditing() {
	return new Set(['INPUT', 'TEXTAREA']).has(document.activeElement.tagName);
}

function openGoTo() {
	closePopups();
	let menuPanel = $id('goToMenuPanel');
	menuPanel.style.display = '';

	let goToInput = $id('goToInput');
	goToInput.focus();
	goToInput.select();
}

function openAbout() {
	closePopups();

	g_bookElem.style.display = 'none';
	$id('intro').innerHTML = settings.about;
	$id('intro').style.display = '';

	if (!g_isDualPanel) {
		g_readPanel.style.display = 'flex';
		g_searchPanel.style.display = 'none';
	}
}

function registerPopup(popup) {
	g_popups.push(popup);
	popup.addEventListener('click', e => {
		e.stopPropagation();
	});
}

function closePopups() {
	g_popups.forEach(popup => popup.style.display = 'none');
}

window.addEventListener('click', e => {
	closePopups();
});

window.addEventListener('click', e => {
	if (e.target.classList.contains('ref-range')) {
		read(e.target.innerText, {highlightPassagePermanently: true});	
	} else if (e.target.tagName == 'INTERLINEAR-WORD') {
		openSearch();
		$id('searchBox').value = e.target.getAttribute('data-strong');
		runQuery();
	}
});

onLoad.then(() => {
	document.body.appendChild(g_readPanel);
	document.body.appendChild(g_searchPanel);
});

exportDebug('bibleUi', bibleUi);
exportDebug('query', query);
exportDebug('refs', refs);
exportDebug('resources', resources);
exportDebug('settings', settings);