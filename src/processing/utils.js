import fs from 'fs';
import path from 'path';

export function writeBibleFilesSync(bibleName, bible) {
	fs.writeFileSync(
		path.join('build', 'resources', bibleName + '.json'), JSON.stringify(bible), 'utf8');

	for (let [k, v] of Object.entries(bible)) {
		fs.writeFileSync(
			path.join('build', 'resources', `${bibleName}_${k}.json`), JSON.stringify(v, null, '\n').replace(/\n\n/g, '\n'), 'utf8');
	}
}