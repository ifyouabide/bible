import * as bible_ui from './bible_ui.js';
import * as bible_utils from './bible_utils.js';
import * as books from '../common/books.js';
import * as query from './query.js';
import * as resources from './resources.js';
import * as result_ui from './result_ui.js';
import {$id, exportDebug, onLoad, client} from './utils.js';

let g_about = `
	<h3>About</h3>
	<div style="margin-left:50px">
		The Literal Standard Version of The Holy Bible is a registered copyright of
		Covenant Press and the Covenant Christian Coalition (© 2020).
		The LSV has a permissive copyright: all non-commercial use is permissible as long as the text is unaltered.
		See the <a href="https://www.lsvbible.com">LSV website</a> for more details.
		This website is not	affiliated with Covenant Press or the CCC.
		<br/><br/>
		Questions/comments? Email <a href="mailto:ifyouabide@googlegroups.com">ifyouabide@googlegroups.com</a>
		<br/>
		We are an open source project: <a target="_blank" href="https://github.com/kenkania/bible">code</a>
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

let g_welcome = `
	<div style="max-width:600px;margin-top:50px;">
		<center><h2>Welcome to the Bible (LSV) Reader/Searcher</h2></center>
		${g_about}
	</div>
`;

function read(str, {highlightPassagePermanently = false} = {}) {
	let refRange = bible_utils.RefRange.parse(str);
	if (!refRange) return false;

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
	{
		$id('bookSelect').innerHTML = books.codes
			.map(bk => `<option name="${bk}">${books.codeToName[bk]}</option>`)
			.join('');
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
		resources.startingBookPromise.then(() => read(resources.startingRef));
	}

	if (client.isFullVersion) {
		$id('searchPanel').style.display = '';
		g_resultElem = result_ui.createElement({id: 'resultPanel'});
		$id('searchPanel').insertBefore(g_resultElem, $id('searchPanel').firstChild);
		g_resultElem.showHtml(g_welcome);

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