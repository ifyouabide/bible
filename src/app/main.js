import * as bible_ui from './bible_ui.js';
import * as bible_utils from './bible_utils.js';
import * as books from '../common/books.js';
import * as query from './query.js';
import * as resources from './resources.js';
import * as result_ui from './result_ui.js';
import {$id, exportDebug, onLoad, client} from './utils.js';

let g_basicInstructions = client.isFullVersion ? `
	To read the Bible, select a book from the top-left dropdown.
	To search the Bible, enter a search term in the bottom-right search box and press 'Search'.
` : `
	To read the Bible, select a book from the top-left dropdown.
	To search the Bible, press the 'Search' button at the bottom.
`;

let g_about = `
	<h4>ABOUT</h4>
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

let g_intro = `
	<div id="intro" style="margin-top:2rem;">
		<center><h2>Welcome to the LSV Bible Reader</h2></center>
		<div style="padding:1rem;">
			${g_basicInstructions}
			<br/>
			${g_about}
		</div>
	</div>
`;

let g_body = `
	<style>
		#readPanel, #searchPanel {
			display: flex;
			flex-direction: column;
			min-height: 100vh;
			max-height: 100vh;
		}
		#readPanel {
			max-width: 40rem;
		}
		#searchPanel {
			flex-grow: 1;
			flex-shrink: 100;
		}
		#resultPanel {
			flex-grow: 1;
		}

		#book {
			flex-grow: 1;
			line-height: 1.7rem;
			padding-top: 1.2rem;
			padding-left: 2rem;
			padding-right: 2rem;

			overflow-y: auto;
			overflow-x: hidden;
			text-align: justify;
		}

		#resultPanel {
			flex-grow: 1;
			padding-left: 2rem;
			padding-right: 2rem;

			overflow-y: scroll;
			overflow-x: hidden;
		}
	</style>
	<div id="readPanel" style="visibility:hidden;">
		<div class="bar" style="justify-content:space-between;min-height:2rem;">
			<select id="bookSelect" style="margin-left:2rem;width:8rem;height:2rem;"></select>
			<a
				href="https://www.lsvbible.com" rel="noopener" class="theme" target="_blank"
				style="padding-top:.3rem;padding-left:1rem;padding-right:1rem;">LSV
			</a>
			<span style="display:inline-block;margin-right:2rem;width:8rem">
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
						padding-right:2rem;
						text-align:right;
					"></select>
			</span>
		</div>
		${g_intro}
	</div>
	<div id="searchPanel" style="display:none;">
		<div class="bar" style="display:flex;">
			<input id="helpButton" type="button" value="Help">
			<input id="clearButton" type="button" value="Clear">
			<textarea id="searchBox" style="flex-grow:1;min-height:3rem;resize:vertical;"></textarea>
			<input id="searchButton" type="button" value="Search">
		</div>
	</div>
`;

let g_shortcutHelp = `
	<h3>Shortcuts</h3>
	<div style="margin-left:50px">
		<table>
			<tr><td>Focus the reference box</td><td><i>/</i></td></tr>
			<tr><td>Focus the search box</td><td><i>?</i></td></tr>
			<tr><td>Perform a search</td><td><i>shift+Enter</i> (when the search box is focused)</td></tr>
		</table>
	</div>
`;

let g_help = `
	<div style="max-width:600px;margin-top:50px;">
		${query.searchHelp}
		${g_shortcutHelp}
	</div>
`;

function read(str, {highlightPassagePermanently = false} = {}) {
	let refRange = bible_utils.RefRange.parse(str);
	if (!refRange) return false;

	$id('intro').style.display = 'none';

	refRange = refRange.snapToExisting().limitToSingleBook();

	let readRange = bible_utils.RefRange.parse(client.isFullVersion
		? refRange.start.book : (refRange.start.book + refRange.start.chapter + ':'));

	if (g_bookElem.show(readRange, {scrollToRef: refRange.start})) {
		$id('bookSelect').selectedIndex = books.codes.indexOf(refRange.start.book);

		if (client.isFullVersion) {
			g_bookElem.highlightPassage(
				str.indexOf('-') != -1 ? refRange : refRange.start, highlightPassagePermanently);
			if (g_results) g_bookElem.highlightHits(g_results.hits);
			if ($id('refInput') != document.activeElement) {
				$id('refInput').value = refRange.start.toString();
			}
		} else {
			let chapterCount = bible_utils.Ref.parseChapter(
				Object.keys(resources.bible[refRange.start.book]['refs']).slice(-1)[0]);
			$id('chapterSelect').innerHTML = Array.from(Array(chapterCount), (_, i) => i + 1)
				.map(ch => `<option name="${refRange.start.book}${ch}">${ch}</option>`);
			$id('chapterSelect').selectedIndex = refRange.start.chapter - 1;
		}
		return true;
	}
	return false;
}

function runQuery() {
	g_results = query.run($id('searchBox').value);
	if (!g_results) return;
	g_resultElem.show(g_results);
	g_bookElem.highlightHits(g_results.hits);
}

function isEditing() {
	return new Set(['INPUT', 'TEXTAREA']).has(document.activeElement.tagName);
}

let g_bookElem;
let g_resultElem;
let g_results;

onLoad().then(() => {
	document.body.innerHTML = g_body;

	{
		$id('bookSelect').innerHTML = '<option>Book</option>' + books.codes
			.map(bk => `<option name="${bk}">${books.codeToName[bk]}</option>`)
			.join('');
		$id('bookSelect').children[0].disabled = true;
		$id('bookSelect').addEventListener('change', e => {
			read(books.codes[e.target.selectedIndex]);
			g_bookElem.focus();
		}, false);

		if (client.isFullVersion) {
			$id('refInput').style.display = '';
			$id('refInput').addEventListener('input', e => {
				read(e.target.value);
			});
			$id('refInput').addEventListener('keydown', e => {
				if (e.key == 'Enter') {
					g_bookElem.focus();
				}
			});
			window.addEventListener('keydown', e => {
				if (!isEditing() && e.key == '/') {
					$id('refInput').focus();
					$id('refInput').select();
					e.preventDefault();
				}
			});
		} else {
			$id('chapterSelect').style.display = '';
			$id('chapterSelect').addEventListener('change', e => {
				read(e.target.children[e.target.selectedIndex].getAttribute('name'));
				g_bookElem.focus();
			});
		}

		g_bookElem = bible_ui.createElement({id: 'book'});
		$id('readPanel').appendChild(g_bookElem);
		if (resources.startingRef) {
			resources.startingBookPromise.then(() => {
				read(resources.startingRef);
				$id('readPanel').style.visibility = 'visible';
			});
		} else {
			$id('readPanel').style.visibility = 'visible';
		}
	}

	if (client.isFullVersion) {
		$id('searchPanel').style.display = '';
		g_resultElem = result_ui.createElement({id: 'resultPanel'});
		$id('searchPanel').insertBefore(g_resultElem, $id('searchPanel').firstChild);

		$id('helpButton').addEventListener('click', () => g_resultElem.showHtml(g_help));
		$id('clearButton').addEventListener('click', () => {
			g_results = null;
			g_resultElem.showHtml('');
			g_bookElem.highlightHits([]);
		});

		$id('searchButton').addEventListener('click', runQuery);
		$id('searchBox').addEventListener('keydown', e => {
			if (e.shiftKey && e.key == 'Enter') {
				runQuery();
				e.stopPropagation();
				e.preventDefault();
			}
		});
		window.addEventListener('keyup', e => {
			if (!isEditing() && e.key == '?') {
				$id('searchBox').focus();
				$id('searchBox').select();
			}
		});
	}

	window.addEventListener('click', e => {
		if (e.target.classList.contains('ref-range')) {
			read(e.target.innerText, {highlightPassagePermanently: true});	
		}
	});
});

exportDebug('bible_utils', bible_utils);
exportDebug('query', query);