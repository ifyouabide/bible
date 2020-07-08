export const codeToName = {
	'ge': 'Genesis',
	'ex': 'Exodus',
	'le': 'Leviticus',
	'nu': 'Numbers',
	'de': 'Deuteronomy',
	'jos': 'Joshua',
	'jg': 'Judges',
	'ru': 'Ruth',
	'1sa': '1 Samuel',
	'2sa': '2 Samuel',
	'1ki': '1 Kings',
	'2ki': '2 Kings',
	'1ch': '1 Chronicles',
	'2ch': '2 Chronicles',
	'ezr': 'Ezra',
	'ne': 'Nehemiah',
	'es': 'Esther',
	'jb': 'Job',
	'ps': 'Psalms',
	'pr': 'Proverbs',
	'ec': 'Ecclesiastes',
	'so': 'Song of Songs',
	'is': 'Isaiah',
	'je': 'Jeremiah',
	'la': 'Lamentations',
	'ek': 'Ezekiel',
	'da': 'Daniel',
	'ho': 'Hosea',
	'jl': 'Joel',
	'am': 'Amos',
	'ob': 'Obadiah',
	'jon': 'Jonah',
	'mi': 'Micah',
	'na': 'Nahum',
	'hk': 'Habakkuk',
	'zp': 'Zephaniah',
	'hg': 'Haggai',
	'zc': 'Zechariah',
	'ml': 'Malachi',
	'mt': 'Matthew',
	'mk': 'Mark',
	'lk': 'Luke',
	'jn': 'John',
	'ac': 'Acts',
	'ro': 'Romans',
	'1co': '1 Corinthians',
	'2co': '2 Corinthians',
	'ga': 'Galatians',
	'ep': 'Ephesians',
	'pp': 'Philippians',
	'co': 'Colossians',
	'1th': '1 Thessalonians',
	'2th': '2 Thessalonians',
	'1ti': '1 Timothy',
	'2ti': '2 Timothy',
	'ti': 'Titus',
	'phm': 'Philemon',
	'he': 'Hebrews',
	'ja': 'James',
	'1pe': '1 Peter',
	'2pe': '2 Peter',
	'1jn': '1 John',
	'2jn': '2 John',
	'3jn': '3 John',
	'jude': 'Jude',
	're': 'Revelation',
};

export const codes = Object.keys(codeToName);
export const codeSet = new Set(codes);
export const ot = new Set(Object.keys(codeToName).slice(0, 39));
export const nt = new Set(Object.keys(codeToName).slice(39));