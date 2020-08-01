import fs from 'fs';
import path from 'path';

import * as mapToOriginal from './map_to_original.js';
import {writeMapFilesSync} from '../utils.js';

let lsv = JSON.parse(fs.readFileSync(path.join('build', 'resources', 'lsv_verse_text.json'), 'utf8'));
let kjv = JSON.parse(fs.readFileSync(path.join('build', 'resources', 'kjv_verse_text.json'), 'utf8'));
let tr = JSON.parse(fs.readFileSync(path.join('build', 'resources', 'tr_verse_token.json'), 'utf8'));
let kjvToTr = JSON.parse(fs.readFileSync(path.join('build', 'resources', 'map_kjv_to_tr_verse_token.json'), 'utf8'));
let lsvToTr = mapToOriginal.mapUsingSimilarTranslation(lsv, tr, kjv, kjvToTr);
writeMapFilesSync(lsvToTr, 'lsv', lsv, 'tr', tr);