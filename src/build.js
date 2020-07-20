import fs from 'fs';
import path from 'path';

function copy(srcPath, dstPath, substitutions = {}) {
	let contents = fs.readFileSync(srcPath, 'utf8');
	for (let [k, v] of Object.entries(substitutions)) {
		contents = contents.replace(k, v);
	}
	fs.writeFileSync(path.join('build', dstPath), contents, 'utf8');
}

let analytics = `
	<script async src="https://www.googletagmanager.com/gtag/js?id=G-CXSNEEWJWN"></script>
	<script>
		window.dataLayer = window.dataLayer || [];
		function gtag(){dataLayer.push(arguments);}
		gtag('js', new Date());

		gtag('config', 'G-CXSNEEWJWN');
	</script>
`;

copy(path.join('src', 'app', 'bible.html'), 'bible.html', {
	'<!--${headStart}-->': analytics,
});

copy(path.join('src', 'app', 'bible.css'), 'bible.css');

let base = `<base href="https://storage.googleapis.com/lsvbible/">`;

copy(path.join('src', 'app', 'bible.html'), path.join('mini', 'index.html'), {
	'<!--${headStart}-->': analytics + base,
});