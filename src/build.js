import child_process from 'child_process';
import cpy from 'cpy';
import fs from 'fs';
import path from 'path';

let appName = process.argv[2];
let app = {
	ifyouabide: {
		canonical: 'https://ifyouabide.org',
		description: '',
		bible: 'kjv',
		title: 'ifyouabide.org',
		favicon: path.join('src', 'app', 'favicon.ico'),
		analyticsTag: 'UA-172306160-1',
	},
	lsvbible: {
		canonical: 'https://read.lsvbible.com',
		description: 'A reader for the Literal Standard Version (LSV) Bible, with search capabilities.',
		bible: 'lsv',
		title: 'The LSV Bible Reader',
		favicon: path.join('third_party', 'lsv', 'favicon.ico'),
		analyticsTag: 'G-CXSNEEWJWN',
	},
}[appName];
app.name = appName;

let outDir = path.join('build', app.name);
fs.mkdirSync(outDir, {recursive: true});

function compile() {
	let outFile = path.join(outDir, 'main.js');
	let result = child_process.spawnSync('npm', [
			'run',
			'cc',
			'--',
			'src/app/*.js',
			'src/common/*.js',
			`--js_output_file=${outFile}`,
			'--compilation_level=ADVANCED_OPTIMIZATIONS',
			'--language_out=ECMASCRIPT6',
		], {
			shell: true,
			encoding: 'utf8',
		});

	console.error(result.stderr);
	if (result.status !== 0) {
		throw new Error('compilation failed. see above');
	}
	console.log(result.stdout);

	// We just prefix the compiled JS with the site name. This isn't great as it prevents some
	// optimizations. But -D doesn't work with es6 modules.
	copy(outFile, 'main.js', {'\'use strict\';': `'use strict';window.app='${app.name}';`});
}

function copy(srcPath, dstPath, substitutions = {}) {
	let substitutionEntries = Object.entries(substitutions);
	let encoding = substitutionEntries.length ? 'utf8' : null;
	let contents = fs.readFileSync(srcPath, encoding);
	for (let [k, v] of substitutionEntries) {
		contents = contents.replace(k, v);
	}
	fs.mkdirSync(path.dirname(path.join(outDir, dstPath)), {recursive: true});
	fs.writeFileSync(path.join(outDir, dstPath), contents, encoding);
}

compile();


let head = `
	<script async src="https://www.googletagmanager.com/gtag/js?id=${app.analyticsTag}"></script>
	<script>
		window.dataLayer = window.dataLayer || [];
		function gtag(){dataLayer.push(arguments);}
		gtag('js', new Date());

		gtag('config', '${app.analyticsTag}');
	</script>
	<title>${app.title}</title>
	<meta name="description" content="${app.description}">
	<link rel="canonical" href="${app.canonical}">
`;
copy(path.join('src', 'app', 'index.html'), 'index.html', {
	'<!--${headStart}-->': head,
});
copy(path.join('src', 'app', 'bible.css'), 'bible.css');
copy(app.favicon, 'favicon.ico');

let base = `<base href="https://storage.googleapis.com/${app.name}/">`;
copy(
	path.join('src', 'app', 'index.html'), path.join('mini', 'index.html'), {
		'<!--${headStart}-->': head + base,
	});

(async () => {
    await cpy(`build/resources/${app.bible}*.json`, path.join(outDir, 'resources'));
})();