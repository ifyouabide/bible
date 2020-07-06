"""Generates LSV-related resources in build/resources."""

import json
import os

book_to_code = {
	'GENESIS': 'ge',
	'EXODUS': 'ex',
	'LEVITICUS': 'le',
	'NUMBERS': 'nu',
	'DEUTERONOMY': 'de',
	'JOSHUA': 'jos',
	'JUDGES': 'jg',
	'RUTH': 'ru',
	'1 SAMUEL': '1sa',
	'2 SAMUEL': '2sa',
	'1 KINGS': '1ki',
	'2 KINGS': '2ki',
	'1 CHRONICLES': '1ch',
	'2 CHRONICLES': '2ch',
	'EZRA': 'ezr',
	'NEHEMIAH': 'ne',
	'ESTHER': 'es',
	'JOB': 'jb',
	'PSALMS': 'ps',
	'PROVERBS': 'pr',
	'ECCLESIASTES': 'ec',
	'SONG OF SONGS': 'so',
	'ISAIAH': 'is',
	'JEREMIAH': 'je',
	'LAMENTATIONS': 'la',
	'EZEKIEL': 'ek',
	'DANIEL': 'da',
	'HOSEA': 'ho',
	'JOEL': 'jl',
	'AMOS': 'am',
	'OBADIAH': 'ob',
	'JONAH': 'jon',
	'MICAH': 'mi',
	'NAHUM': 'na',
	'HABAKKUK': 'hk',
	'ZEPHANIAH': 'zp',
	'HAGGAI': 'hg',
	'ZECHARIAH': 'zc',
	'MALACHI': 'ml',
	'MATTHEW': 'mt',
	'MARK': 'mk',
	'LUKE': 'lk',
	'JOHN': 'jn',
	'ACTS': 'ac',
	'ROMANS': 'ro',
	'1 CORINTHIANS': '1co',
	'2 CORINTHIANS': '2co',
	'GALATIANS': 'ga',
	'EPHESIANS': 'ep',
	'PHILIPPIANS': 'pp',
	'COLOSSIANS': 'co',
	'1 THESSALONIANS': '1th',
	'2 THESSALONIANS': '2th',
	'1 TIMOTHY': '1ti',
	'2 TIMOTHY': '2ti',
	'TITUS': 'ti',
	'PHILEMON': 'phm',
	'HEBREWS': 'he',
	'JAMES': 'ja',
	'1 PETER': '1pe',
	'2 PETER': '2pe',
	'1 JOHN': '1jn',
	'2 JOHN': '2jn',
	'3 JOHN': '3jn',
	'JUDE': 'jude',
	'REVELATION': 're',
}

def GetVerses(text, bk, ch):
	text = ' ' + ' '.join(text.strip().split('\n')).replace('  ', ' ').replace('  ', ' ').replace('  ', ' ').strip()
	vs = []
	start = 0
	missing = []
	consec_missing = 0
	for v in range(1, 200):
		v_sub = ' ' + str(v) + ' '
		try:
			found = text.index(v_sub, start)
			if found - start > 800:
				print(bk, ch, v_sub)
				moo()
			start = found + len(v_sub)
			vs += [(v, found, start)]
			consec_missing = 0
		except ValueError as e:
			missing += ['%s%s:%s' % (bk, ch, v_sub.strip())]
			consec_missing += 1
		if consec_missing > 10:
			missing = missing[:-11]
			break
	if missing:
		print('missing', '\nmissing '.join(missing))

	vs2 = []
	for i in range(1, len(vs) + 1):
		end = vs[i][1] if (i < len(vs)) else 10000000
		vs2 += [(str(vs[i-1][0]), text[vs[i-1][2]:end])]
	return vs2


script_dir = os.path.dirname(os.path.realpath(__file__))
root_path = os.path.join(script_dir, '..', '..', '..')
resources_path = os.path.join(root_path, 'build', 'resources')
os.makedirs(resources_path, exist_ok=True)
input_path = os.path.join(root_path, 'third_party', 'lsv', 'lsv.txt')
content = open(input_path, 'rb').read().decode('utf-8').strip().replace('\r', '')

books = content.split('=====')
out = {}
for b in books:
	name, contents = b.split('\n', 1)
	bk = book_to_code[name.strip()]
	out[bk] = {}

	chs = contents.split('CHAPTER ')[1:]
	for ch in chs:
		chnum, cc = ch.split('\n', 1)
		chnum = chnum.strip()
		vs = GetVerses(cc, bk, chnum)
		for v in vs:
			out[bk][chnum+':'+v[0]] = v[1] + ('' if v != vs[-1] else '\n')

	open(os.path.join(resources_path, 'lsv_%s.json' % bk), 'w').write(
		json.dumps(out[bk], indent=0))

open(os.path.join(resources_path, 'lsv.json'), 'w').write(json.dumps(out, indent=0))
