import childProcess from 'child_process';
import fs from 'fs';
import path from 'path';
import tempy from 'tempy';

let appName = process.argv[2];
let bucket = {
	ifyouabide: 'ifyouabide.org',
	lsvbible: 'lsvbible',
}[appName];
let version = '2';

function cp(local, remote) {
	let headers = [];
	if (local.endsWith('.br')) {
		headers.push('Content-Encoding:br');
		if (local.endsWith('.json.br')) {
			headers.push('Content-Type:application/json');
		}
	}
	if (remote.endsWith('.br')) {
		remote = remote.slice(0, -3);
	}
	let args = headers.map(h => ['-h', h]).flat().concat(
		'cp',
		local,
		remote
	);
	console.log('gsutil', args.join(' '));
	let result = childProcess.spawnSync(
		'gsutil',
		args, {
			shell: true,
			encoding: 'utf8',
		});
	console.error(result.stderr);
	if (result.status !== 0)
		throw new Error('gsutil cp failed. see above');
	
	console.log(result.stdout);
}

function listFiles(basePath, {prefix = ''} = {}) {
	let entries = fs.readdirSync(basePath, {withFileTypes: true});
	let files = entries
		.filter(e => e.isDirectory())
		.map(e => listFiles(path.join(basePath, e.name), {prefix: e.name}))
		.flat();
	files = files.concat(entries.filter(e => e.isFile()).map(e => prefix.length ? path.join(prefix, e.name) : e.name));
	return files;
}

let root = path.join('build', appName);
let gsDir = `gs://${bucket}/${version}/`;
for (let f of listFiles(root)) {
	cp(path.join(root, f), gsDir + f);
}

// Create mini standalone file for serving anywhere:
{
	let indexContents = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
	let base = `<base href="https://storage.googleapis.com/${bucket}/${version}/">`;
	let miniContents = indexContents.replace('<!--${headStart}-->', base);
	let mini = tempy.writeSync(miniContents, {extension: 'html'});
	cp(mini, gsDir + 'mini/index.html');

	if (appName == 'ifyouabide') {
		fs.mkdirSync(path.join('build', 'firebase'), {recursive: true});

		fs.writeFileSync(path.join('build', 'firebase', 'index.html'), miniContents, 'utf8');
		let result = childProcess.spawnSync('firebase', ['deploy'], {shell: true, encoding: 'utf8'});
		console.error(result.stderr);
		if (result.status !== 0)
			throw new Error('firebase deploy failed. see above');
		console.log(result.stdout);
	}
}