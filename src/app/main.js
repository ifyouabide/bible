import * as bible_ui from './bible_ui.js';
import * as bible_utils from './bible_utils.js';
import * as books from '../common/books.js';
import * as query from './query.js';
import * as resources from './resources.js';
import * as result_ui from './result_ui.js';
import {$id, exportDebug, onLoad, client} from './utils.js';

let g_isDualPanel = client.isDesktop || window.innerWidth > 900;
let g_isBookReadScope = client.isDesktop;

function elem(str) {
	let parent = document.createElement('span');
	parent.innerHTML = str;
	return parent.firstElementChild;
}

let g_readPanel, g_bookElem;
{
	let basicInstructionsHtml = g_isDualPanel ? `
		To read the Bible, select a book from the top-left dropdown.
		To search the Bible, enter a search term in the bottom-right search box and press 'Search'.
	` : `
		To read the Bible, select a book from the top-left dropdown.
		To search the Bible, press the 'Search' button at the bottom.
	`;

	let aboutHtml = `
		<h4>About</h4>
		<div style="margin-left:1rem;">
			The Literal Standard Version of The Holy Bible (LSV) is a registered copyright of
			Covenant Press and the Covenant Christian Coalition (©2020).
			The LSV has a permissive copyright: all non-commercial use is permissible as long as the text is unaltered.
			See <a target="_blank" rel="noopener" href="https://www.lsvbible.com">lsvbible.com</a> for more information.
			<br/><br/>
			Questions about this reader? Email <a href="mailto:ifyouabide@googlegroups.com">ifyouabide@googlegroups.com</a>
			<br/>
			See our <a target="_blank" rel="noopener" href="https://github.com/kenkania/bible">open source project</a> on GitHub.
		</div>
	`;

	let introHtml = `
		<div id="intro" style="margin-top:2rem;overflow-y:auto;">
			<center><h2>Welcome to the LSV Bible Reader</h2></center>
			<div style="padding:1rem;">
				${basicInstructionsHtml}
				<br/>
				${aboutHtml}
			</div>
		</div>
	`;
	g_readPanel = elem(`
		<div
			id="readPanel"
			style="
				visibility:hidden;
				display: flex;
				flex-direction: column;
				min-height: 100vh;
				max-height: 100vh;
				max-width: 40rem;
			">
			<div class="bar" style="justify-content:space-between;min-height:2rem;padding-left:2rem;padding-right:2rem;">
				<span style="width:8rem;">
					<select id="bookSelect" style="height:2rem;">
						<option>Book</option>
						${books.codes
							.map(bk => `<option name="${bk}">${books.codeToName[bk]}</option>`)
							.join('')}
					</select>
					<span id="widthCalculator" style="visibility:hidden;position:absolute;"></span>
				</span>
				<a
					href="https://www.lsvbible.com" rel="noopener" class="theme" target="_blank"
					style="padding-top:.3rem;">LSV
				</a>
				<span style="display:inline-block;width:8rem;">
					<input
						id="refInput" type="text" class="theme" maxlength="9"
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
			<div id="bottomReaderBar" class="bar" style="display:none;padding-top:.3rem;height:1.7rem;padding-left:2rem;padding-right:2rem;">
				<span id="prevChapterButton" style="visibility:hidden;">
					<<
				</span>
				<span style="flex-grow:1;text-align:center;">
					<span id="openSearchButton">
						Search
					</span>
				</span>
				<span id="nextChapterButton" style="visibility:hidden;">
					>>
				</span>
			</div>
		</div>
	`);

	function id(idStr) {
		return g_readPanel.querySelector('#' + idStr);
	}

	// Book/chapter selector:
	{
		id('bookSelect').children[0].disabled = true;
		id('bookSelect').addEventListener('change', e => {
			read(e.target.children[e.target.selectedIndex].getAttribute('name'));
		}, false);

		if (!g_isBookReadScope) {
			id('chapterSelect').style.display = '';
			id('chapterSelect').addEventListener('change', e => {
				read(e.target.children[e.target.selectedIndex].getAttribute('name'));
			});
			id('bottomReaderBar').style.display = 'flex';
			id('prevChapterButton').addEventListener('click', e => {
				read(e.target.getAttribute('name'));
			});
			id('nextChapterButton').addEventListener('click', e => {
				read(e.target.getAttribute('name'));
			});
		}
	}

	if (g_isDualPanel) {  // Configure reference input:
		let refInput = id('refInput');
		refInput.style.display = '';
		refInput.addEventListener('input', e => {
			read(e.target.value, {skipFocus: true});
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
	} else {  // Add button to open the search panel:
		id('bottomReaderBar').style.display = 'flex';
		id('openSearchButton').addEventListener('click', e => {
			g_readPanel.style.display = 'none';
			g_searchPanel.style.display = 'flex';
		});
	}

	g_bookElem = bible_ui.createElement({id: 'book'});
	g_readPanel.insertBefore(g_bookElem, g_readPanel.lastElementChild);
	if (resources.startingRef) {
		resources.startingBookPromise.then(() => {
			read(resources.startingRef);
			g_readPanel.style.visibility = 'visible';
		});
	} else {
		g_readPanel.style.visibility = 'visible';
	}
}

function read(str, {highlightPassagePermanently = false, skipFocus = false} = {}) {
	let refRange = bible_utils.RefRange.parse(str);
	if (!refRange) return false;

	if (!g_isDualPanel) {
		g_readPanel.style.display = 'flex';
		g_searchPanel.style.display = 'none';
	}
	$id('intro').style.display = 'none';

	refRange = refRange.snapToExisting().limitToSingleBook();

	let readRange = bible_utils.RefRange.parse(g_isBookReadScope
		? refRange.start.book : (refRange.start.book + refRange.start.chapter + ':'));

	if (g_bookElem.show(readRange, {scrollToRef: refRange.start})) {
		g_bookElem.highlightPassage(
			str.indexOf('-') != -1 ? refRange : refRange.start, highlightPassagePermanently);
		if (g_results) g_bookElem.highlightHits(g_results.hits);

		$id('bookSelect').selectedIndex = books.codes.indexOf(refRange.start.book) + 1;
		$id('widthCalculator').innerText = books.codeToName[refRange.start.book];
		$id('bookSelect').style.width = parseInt($id('widthCalculator').offsetWidth) + 1 + 'px';

		if (g_isBookReadScope) {
			if ($id('refInput') != document.activeElement) {
				$id('refInput').value = refRange.start.toString();
			}
		} else {
			let chapterCount = bible_utils.Ref.parseChapter(
				Object.keys(resources.bible[readRange.start.book]['refs']).slice(-1)[0]);
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
	g_searchPanel = elem(`
		<div
			id="searchPanel"
			style="
				display: ${g_isDualPanel ? 'flex' : 'none'};
				flex-direction: column;
				min-height: 100vh;
				max-height: 100vh;
				flex-grow: 1;
				flex-shrink: 100;
			">
			<div class="bar" style="display:flex;">
				<input id="helpButton" type="button" value="Help">
				<input id="clearButton" type="button" value="Clear">
				<textarea id="searchBox" style="flex-grow:1;min-height:3rem;resize:vertical;"></textarea>
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

	g_resultElem = result_ui.createElement({id: 'resultPanel'});
	g_searchPanel.insertBefore(g_resultElem, g_searchPanel.firstChild);

	if (!g_isDualPanel) {
		let topBar = elem(`
			<div class="bar" style="justify-content:center;padding-top:.3rem;height:1.7rem;">
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
			id('searchBox').focus();
			id('searchBox').select();
		}
	});

	window.addEventListener('click', e => {
		if (e.target.classList.contains('ref-range')) {
			read(e.target.innerText, {highlightPassagePermanently: true});	
		}
	});
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

exportDebug('bible_utils', bible_utils);
exportDebug('query', query);
exportDebug('resources', resources);