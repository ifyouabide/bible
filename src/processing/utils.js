import fs from 'fs';
import path from 'path';

export function writeBibleFilesSync(bibleName, bible) {
	let dir = path.join('build', 'resources');
	fs.mkdirSync(dir, {recursive: true});

	fs.writeFileSync(path.join(dir, bibleName + '.json'), JSON.stringify(bible), 'utf8');

	for (let [k, v] of Object.entries(bible)) {
		fs.writeFileSync(
			path.join(dir, `${bibleName}_${k}.json`),
			JSON.stringify(v, null, '\n').replace(/\n\n+/g, '\n'),
			'utf8');
	}
}