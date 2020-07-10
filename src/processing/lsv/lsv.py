"""Generates LSV-related resources in build/resources."""

import json
import os
import re

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

PSALMS_WITH_PRESCRIPTS = [
	3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
	22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 34, 35, 36, 37, 38,
	39, 40, 41, 42, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55,
	56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 72,
	73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88,
	89, 90, 92, 98, 100, 101, 102, 103, 108, 109, 110, 120, 121, 122,
	123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 138,
	139, 140, 141, 142, 143, 144, 145
] 

def GetVerses(text, bk, ch):
	for i in range(10):
		text = text.replace('  ', ' ')
	lines = text.strip().split('\n')
	text = ' ' + ''.join(lines)

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
		content = text[vs[i-1][2]:end]
		if not content.endswith('—') and not content.endswith('[') and i != len(vs):
			content += ' '
		if bk == 'ps' and vs[i-1][0] == 1:
			if int(ch) in PSALMS_WITH_PRESCRIPTS:
				sentences = content.split('||')[0].split('.')
				for si in range(len(sentences)):
					if re.search(r'[a-z]', sentences[si]):
						prescript = '.'.join(sentences[:si]) + '. '
						content = content[len(prescript):]
						vs2 += [('0', prescript)]
						break
				else:
					moo()

		vs2 += [(str(vs[i-1][0]), content)]
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
			out[bk][chnum+':'+v[0]] = v[1]

	open(os.path.join(resources_path, 'lsv_%s.json' % bk), 'wb').write(
		json.dumps(out[bk], indent=0, ensure_ascii=False).encode('utf8'))

open(os.path.join(resources_path, 'lsv.json'), 'wb').write(
	json.dumps(out, indent=0, ensure_ascii=False).encode('utf8'))
