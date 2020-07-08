import * as books from '../common/books.js';
import * as resources from './resources.js';

/**
 * An immutable reference to a book, chapter, and verse.
 * The book is guaranteed to be valid, but the chapter and/or verse are not.
 * Note, verses within a chapter may not be contiguous, and some psalms have a verse 0.
 */
export class Ref {
	/**
	 * Returns a new actual Ref or undefined if invalid.
	 * If the chapter is missing, will default to the first chapter and verse.
	 * If the verse is missing, will default to the first verse of the chapter.
	 */
	static parse(str) {
		let bk = Ref.parseBook(str);
		if (!bk) return;
		let ch = Ref.parseChapter(str);
		if (!ch) {
			return Ref.firstWithPrefix(bk);
		}
		let v = Ref.parseVerse(str);
		if (v === undefined) {
			return Ref.firstWithPrefix(bk + ch + ':');
		}
		return new Ref(bk, ch, v);
	}

	/** Returns the valid book code or undefined. */
	static parseBook(str) {
		let chStart = str.slice(1).search(/\d/);
		let bk = (chStart != -1) ? str.slice(0, chStart + 1) : str;
		if (books.codeSet.has(bk)) return bk;
	}

	/** Returns `${chapter}:${verse}` or undefined. */
	static parseChapterAndVerse(str) {
		let index = str.search(/\d+:\d+$/);
		if (index != -1) return str.slice(index);
	}

	/** Returns the chapter or undefined if missing or not positive. */
	static parseChapter(str) {
		let index = str.search(/\d+[:$]/);
		if (index == -1) return;
		let ch = parseInt(str.slice(index).split(':', 1)[0]);
		if (!isNaN(ch) && ch > 0) return ch;
	}

	/** Returns the verse or undefined if missing or negative. */
	static parseVerse(str) {
		let match = str.match(/\d+:(\d+)/);
		if (!match) return;
		let v = parseInt(match[1]);
		if (!isNaN(v) && v >= 0) return v;
	}

	/** Returns the first ref with the given prefix or undefined if none. */
	static firstWithPrefix(refPrefix) {
		let book = Ref.parseBook(refPrefix);
		if (!book) return;
		refPrefix = refPrefix.substr(book.length);

		let refs = resources.bible[book]['refs'];
		for (let ref in refs) {
			if (ref.startsWith(refPrefix)) {
				return Ref.parse(book + ref);
			}
		}
	}

	/** Returns the last ref with the given prefix or undefined if none. */
	static lastWithPrefix(refPrefix) {
		let book = Ref.parseBook(refPrefix);
		if (!book) return;
		refPrefix = refPrefix.substr(book.length);

		let refs = resources.bible[book]['refs'];
		let last;
		for (let ref in refs) {
			if (ref.startsWith(refPrefix)) {
				last = ref;
			}
		}
		if (!last) return;

		return Ref.parse(book + last);
	}

	constructor(book, chapter, verse) {
		if (!books.codeSet.has(book)) {
			throw new Error('Invalid book: ' + book);
		}
		this.book = book;
		this.chapter = chapter;
		this.verse = verse;
		Object.freeze(this);
	}

	exists() {
		return this.chapterAndVerse in resources.bible[this.book]['refs'];
	}

	/**
	 * Snaps to the closest existing ref, preferring the following verse (if's in the same chapter).
	 * If the chapter is before everything, the first is used.
	 * If the chapter is after everything, the last is used.
	 * Otherwise:
	 *   -if the verse is before everything, the first verse is used.
	 *   -if the verse is after everything, the last verse is used.
	 *   -otherwise, the first verse greater than the verse is used.
	 */
	snapToExisting() {
		if (this.exists()) return this;

		let bookRefs = resources.bible[this.book]['refs'];
		if (this.chapter < 1) {
			return new Ref(this.book, Ref.parseChapter(bookRefs[0]), Ref.parseVerse(bookRefs[0]));
		} else {
			let lastRef = bookRefs.slice(-1)[0];
			let lastCh = Ref.parseChapter(lastRef);
			if (this.chapter > lastCh) {
				return new Ref(this.book, Ref.parseChapter(lastRef), Ref.parseVerse(lastRef));
			}
		}

		let lastV;
		for (let ref in resources.bible[this.book]['refs']) {
			if (Ref.parseChapter(ref) == this.chapter) {
				let refV = Ref.parseVerse(ref);
				if (refV > this.verse) {
					return new Ref(this.book, this.chapter, refV);
				} else {
					lastV = refV;
				}
			} else if (lastV) {
				return new Ref(this.book, this.chapter, lastV);
			}
		}
		throw new Error('snapToExisting: internal error');
	}

	/** Seeks by the given amount, within a single book. */
	seek({by = 1} = {}) {
		if (!this.exists()) {
			throw new Error('Cannot seek starting from non-existent ref');
		}

		let refs = Object.keys(resources.bible[this.book]['refs']);
		let index = refs.indexOf(this.chapterAndVerse) + by;
		if (index < 0 || index >= refs.length) return;
		let ref = refs[index];
		return new Ref(this.book, Ref.parseChapter(ref), Ref.parseVerse(ref));
	}

	get chapterAndVerse() {
		return `${this.chapter}:${this.verse}`;
	}

	/** Returns -1 if less, 0 if equal, 1 if greater. */
	order(otherRef) {
		if (this.equals(otherRef)) return 0;

		let sb = books.codes.indexOf(this.book);
		let eb = books.codes.indexOf(otherRef.book);
		if (sb != eb) {
			return sb < eb ? -1 : 1;
		}
		if (this.chapter != otherRef.chapter) {
			return this.chapter < otherRef.chapter ? -1 : 1;
		}
		return this.verse < otherRef.verse ? -1 : 1;
	}

	startsChapter() {
		return Ref.firstWithPrefix(this.book + this.chapter + ':').verse == this.verse;
	}

	toString() {
		return this.book + this.chapterAndVerse;
	}

	equals(other) {
		return this.book == other.book && this.chapter == other.chapter
			&& this.verse == other.verse;
	}
}

/**
 * An immutable range of verses, defined by an inclusive start and inclusive end Ref.
 * The start and end verses are guaranteed to be in order.
 */
export class RefRange {
	static parse(str) {
		let start = RefRange.parseStartRef(str);
		let end = RefRange.parseEndRef(str);
		if (!start || !end) return;
		if (start.order(end) > 0) return;
		return new RefRange(start, end);
	}

	/** Returns the start ref or undefined if invalid/missing. */
	static parseStartRef(str) {
		return Ref.parse(str.trim().split('-', 1)[0]);
	}

	/** Returns the end ref or undefined if invalid/missing. */
	static parseEndRef(str) {
		str = str.trim();
		let parts = str.split('-', 2);
		// Case: same start/end (bk[1:[1]])
		if (parts.length == 1) {
			let end = parts[0];
			// Subcase: bk1:
			if (end.endsWith(':')) return Ref.lastWithPrefix(end);
			// Subcase: book, chapter, verse
			if (end.indexOf(':') != -1) return Ref.firstWithPrefix(end);
			// Subcase: book, chapter
			if (Ref.parseChapter(end)) return Ref.lastWithPrefix(end + ':');
			// Subcase: book (bk)
			if (Ref.parseBook(end))	return Ref.lastWithPrefix(end);
			return;
		}

		let end = parts[1];
		let hasBook = end.slice(0, 2).search(/\d?[a-z]/) != -1;
		let book = Ref.parseBook(hasBook ? end : parts[0]);
		if (hasBook && !book) {
			return;
		}

		// Case: chapter and verse, maybe book (bk[1[:2]]-[ob]3:4)
		if (end.indexOf(':') != -1) {
			return Ref.parse((hasBook ? '' : book) + end);
		}
		// Case: book, maybe chapter (bk[1[:2]]-ob[3])
		if (hasBook) {
			if (end == book) {
				return Ref.lastWithPrefix(book);
			}
			return Ref.lastWithPrefix(end + ':');
		}
		// Case: verse or chapter (bk1:1-3 or bk1-3)
		let num = parseInt(end);
		if (isNaN(num)) return;
		// Subcase: verse (bk1:1-3)
		if (parts[0].indexOf(':') != -1) {
			if (!Ref.parseChapter(parts[0])) return;
			return new Ref(book, Ref.parseChapter(parts[0]), num);
		}
		// Subcase: chapter (bk1-3)
		return Ref.lastWithPrefix(book + num + ':');
	}

	constructor(start, end) {
		this.start = start;
		this.end = end;
		if (start.order(end) > 0) {
			throw new Error('Out of order ref range: ' + this);
		}
		Object.freeze(this);
	}

	toString() {
		if (this.start.book == this.end.book) {
			if (this.start.chapter == this.end.chapter) {
				if (this.start.verse == this.end.verse) {
					return this.start.toString();
				}
				return this.start.toString() + '-' + this.end.verse;
			}
			return this.start.toString() + '-' + this.end.chapterAndVerse;
		}
		return this.start.toString() + '-' + this.end;
	}

	snapToExisting() {
		return new RefRange(
			this.start.snapToExisting(),
			this.end.snapToExisting());
	}

	isWithinSingleBook() {
		return this.start.book == this.end.book;
	}

	limitToSingleBook() {
		if (this.start.book == this.end.book) return this;

		let end = Ref.lastWithPrefix(this.start.book);
		if (this.start.order(end) > 0) {
			end = this.start;
		}
		return new RefRange(this.start, end);
	}

	exists() {
		return this.start.exists() && this.end.exists();
	}
}