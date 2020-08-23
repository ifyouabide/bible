import * as books from '../common/books.js';

/** Returns the valid book code or undefined. */
export function parseBook(str) {
	let chStart = str.slice(1).search(/\d/);
	let bk = (chStart != -1) ? str.slice(0, chStart + 1) : str;
	if (books.codeSet.has(bk)) return bk;
}

/** Returns `${chapter}:${verse}` or undefined. */
export function parseChapterAndVerse(str) {
	let index = str.search(/\d+:\d+$/);
	if (index != -1) return str.slice(index);
}

/** Returns the chapter or undefined if missing or not positive. */
export function parseChapter(str) {
	let index = str.search(/\d+(:|$)/);
	if (index == -1) return;
	let ch = parseInt(str.slice(index).split(':', 1)[0]);
	if (!isNaN(ch) && ch > 0) return ch;
}

/** Returns the verse or undefined if missing or negative. */
export function parseVerse(str) {
	let match = str.match(/\d+:(\d+)/);
	if (!match) return;
	let v = parseInt(match[1]);
	if (!isNaN(v) && v >= 0) return v;
}

/** Returns -1 if bk1 is less than bk2, 0 if equals, and 1 otherwise. */
export function orderBooks(bk1, bk2) {
	if (bk1 == bk2)
		return 0;
}

/** Returns -1 if the first pair is less than the second, 0 if equals, and 1 otherwise. */
export function orderBookTkiPairs([bk1, tki1], [bk2, tki2]) {
	let order = orderBooks(bk1, bk2);
	if (order != 0) return order;
	if (tki1 == tki2) return 0;
	return tki1 < tki2 ? -1 : 1;
}

export function getChapterCount(bk) {
	return parseChapter(Object.keys(bk['refs']).slice(-1)[0]);
}

export function parse(str) {
	return Ref.parse(str);
}

export function parseRange(str) {
	return RefRange.parse(str);
}

export function parseRanges(str, delimiter = ' ') {
	return RefRange.parseMultiple(str, delimiter);
}

/**
 * An immutable reference to a single book and possibly chapter and possibly verse.
 *
 * The book is guaranteed to be valid, but the chapter and/or verse may be unspecified (-1). If the
 * chapter is unspecified, the verse must be also.
 * The chapter is guaranteed to be -1 or > 0, and the verse is guaranteed to be 1 or >= 0.
 * Verse 0 is used for the psalm title/prescripts.
 *
 * The ref may refer to a verse that does not exist in some or all bibles (e.g. jn100:1).
 *
 * Note, verses within a chapter may not be contiguous in some bibles, and some chapters do not
 * start with verse 1 in some bibles.
 */
export class Ref {
	/**
	 * Returns a new Ref or undefined if invalid.
	 *
	 * To be valid, str must start with a valid book code, followed optionally by a positive
	 * integer, followed optionally by a colon and an integer >= 0.
	 */
	static parse(str) {
		let bk = parseBook(str);
		if (!bk) return;
		let ch = parseChapter(str);
		if (!ch) return new Ref(bk, -1, -1);
		let v = parseVerse(str);
		if (v === undefined) return new Ref(bk, ch, -1);
		return new Ref(bk, ch, v);
	}

	/** Returns the first ref with the given prefix or undefined if none. */
	static firstWithPrefix(bible, refPrefix) {
		let book = parseBook(refPrefix);
		if (!book) return;
		refPrefix = refPrefix.substr(book.length);

		let refs = bible[book]['refs'];
		for (let ref in refs) {
			if (ref.startsWith(refPrefix)) {
				return Ref.parse(book + ref);
			}
		}
	}

	/** Returns the last ref with the given prefix or undefined if none. */
	static lastWithPrefix(bible, refPrefix) {
		let book = parseBook(refPrefix);
		if (!book) return;
		refPrefix = refPrefix.substr(book.length);

		let refs = bible[book]['refs'];
		let last;
		for (let ref in refs) {
			if (ref.startsWith(refPrefix)) {
				last = ref;
			}
		}
		if (!last) return;

		return Ref.parse(book + last);
	}

	static withPrefix(bible, refPrefix, last=false) {
		return last ? Ref.lastWithPrefix(bible, refPrefix) : Ref.firstWithPrefix(bible, refPrefix);
	}

	static containingTki(book, tki) {
		let refAndTkiPairs = Object.entries(book['refs']);
		let ri = 0;
		for (; ri < refAndTkiPairs.length; ri++) {
			if (refAndTkiPairs[ri][1] > tki) {
				break;
			}
		}
		ri--;
		return new Ref(
			book['code'], parseChapter(refAndTkiPairs[ri][0]), parseVerse(refAndTkiPairs[ri][0]));
	}

	constructor(book, chapter, verse) {
		if (!books.codeSet.has(book)) {
			throw new Error('Invalid book: ' + book);
		}
		this.book = book;
		if (this.chapter < 1 && this.chapter != -1) {
			throw new Error('Invalid chapter: ' + chapter);
		}
		this.chapter = chapter;
		if (this.verse < -1) {
			throw new Error('Invalid verse: ' + verse);
		}
		this.verse = verse;
		Object.freeze(this);
	}

	exists(bible) {
		return this.chapterAndVerse in bible[this.book]['refs'];
	}

	/**
	 * Returns a Ref to the nearest existing verse.
	 *
	 * If this ref's chapter is unspecified, will return the first or last verse of the book
	 * (depending on asEnd).
	 * If this ref's verse is unspecified, will return the first or last verse of the book's
	 * chapter (depending on asEnd).
     *
	 * If the chapter is after everything (e.g. jn100), the last verse is used.
	 * Otherwise, the first existing verse greater or lesser than the ref is used (depending on
	 * asEnd).
	 */
	snapToExisting(bible, asEnd = false) {
		if (this.exists(bible)) return this;

		if (this.chapter == -1) return Ref.withPrefix(bible, this.book, asEnd);
		if (this.verse == -1) {
			return Ref.withPrefix(bible, this.book + this.chapter + ':', asEnd)
				|| Ref.lastWithPrefix(bible, this.book);  // if chapter is past all chapters
		}

		let bookRefs = bible[this.book]['refs'];
		if (asEnd) {
			let prevRef;
			for (let ref in bookRefs) {
				let ch = parseChapter(ref);
				if (ch > this.chapter || (ch == this.chapter && parseVerse(ref) > this.verse)) {
					break;
				}
				prevRef = ref;
			}
			if (!prevRef) prevRef = Object.keys(bookRefs)[0];
			return new Ref(this.book, parseChapter(prevRef), parseVerse(prevRef));
		} else {
			let lastV;
			for (let ref in bookRefs) {
				if (parseChapter(ref) == this.chapter) {
					let refV = parseVerse(ref);
					if (refV > this.verse) {
						return new Ref(this.book, this.chapter, refV);
					} else {
						lastV = refV;
					}
				} else if (lastV) {
					return new Ref(this.book, this.chapter, lastV);
				}
			}
			return Ref.lastWithPrefix(bible, this.book);
		}
	}

	/** Seeks by the given amount, within a single book. */
	seek(bible, {by = 1} = {}) {
		if (!this.exists(bible)) {
			throw new Error('Cannot seek starting from non-existent ref');
		}

		let refs = Object.keys(bible[this.book]['refs']);
		let index = refs.indexOf(this.chapterAndVerse) + by;
		if (index < 0 || index >= refs.length) return;
		let ref = refs[index];
		return new Ref(this.book, parseChapter(ref), parseVerse(ref));
	}

	isSpecificVerse() {
		return this.verse != -1;
	}

	/**
	 * Returns ${chapter}:${verse} if both are specified, ${chapter} if only the chapter is
	 * specified, and '' if neither are specified.
	 */
	get chapterAndVerse() {
		if (this.chapter == -1) return '';
		if (this.verse == -1) return '' + this.chapter;
		return `${this.chapter}:${this.verse}`;
	}

	/**
	 * Returns -1 if less, 0 if equal, 1 if greater.
	 *
	 * Throws if the difference in specificity makes it impossible to determine. E.g. jn1 is before
	 * jn2:7, but we throw when comparing jn to jn1 or jn1 to jn1:5.
	 */
	order(otherRef) {
		if (this.equals(otherRef)) return 0;

		let sb = books.codes.indexOf(this.book);
		let eb = books.codes.indexOf(otherRef.book);
		if (sb != eb) {
			return sb < eb ? -1 : 1;
		}

		if ((this.chapter == -1 || otherRef.chapter == -1)
			&& (this.chapter != -1 || otherRef.chapter != -1)) {
				throw new Error(`can't order ${this} ${otherRef}`);
		}

		if (this.chapter != otherRef.chapter) {
			return this.chapter < otherRef.chapter ? -1 : 1;
		}

		if ((this.verse == -1 || otherRef.verse == -1)
			&& (this.verse != -1 || otherRef.verse != -1)) {
				throw new Error(`can't order ${this} ${otherRef}`);
		}

		return this.verse < otherRef.verse ? -1 : 1;
	}

	/** Returns true if this ref has a chapter and verse which are the first in the chapter. */
	startsChapter(bible) {
		return Ref.firstWithPrefix(bible, this.book + this.chapter + ':').verse == this.verse;
	}

	/** Returns true if this ref has a chapter and verse which are the last in the chapter. */
	endsChapter(bible) {
		return Ref.lastWithPrefix(bible, this.book + this.chapter + ':').verse == this.verse;
	}

	/** Returns true if this ref has a chapter and verse which are the first in the book. */
	startsBook(bible) {
		return Ref.firstWithPrefix(bible, this.book).equals(this);
	}

	/** Returns true if this ref has a chapter and verse which are the last in the book. */
	endsBook(bible) {
		return Ref.lastWithPrefix(bible, this.book).equals(this);
	}

	toString() {
		return this.book + this.chapterAndVerse;
	}

	equals(other) {
		if (!other) return false;
		return this.book == other.book && this.chapter == other.chapter
			&& this.verse == other.verse;
	}
}

/**
 * An immutable range of verses, defined by an inclusive start and inclusive end ref.
 *
 * The start and end verses are guaranteed to be in order.
 */
export class RefRange {
	/**
	 * Returns the RefRange or undefined if invalid.
	 *
	 * Note, in "ob1:2-3", "3" is interpreted as a verse, not chapter.
	 * Bit weird, but still ok:
     *   jn[1[:7]]-jn[1[:7]]
     *   jn[1[:7]]-1[:7]
	 */
	static parse(str) {
		let start = RefRange.parseStartRef(str);
		let end = RefRange.parseEndRef(str);
		if (!start || !end) return;

		if (!RefRange.isValidOrder(start, end)) return;
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
		let start = Ref.parse(parts[0]);
		if (!start) return;

		// Case: same start/end (bk[1:[1]])
		if (parts.length == 1) return start;

		let end = parts[1];
		let hasBook = end.slice(0, 2).search(/\d?[a-z]/) != -1;
		if (hasBook) return Ref.parse(end);

		let book = parseBook(str);
		if (!book) return;

		// Case: end has an explicit book (bk[1[:2]]-ob[3[:4]])
		if (hasBook)
			return Ref.parse(end);

		// Case: end has a chapter and verse (bk[1[:2]]-3:4)
		if (end.indexOf(':') != -1) return Ref.parse(book + end);

		// Case: end has a single number (bk[1[:2]]-3)

		// Subcase: start has a verse, so end's single number refers to verse (bk1:2-3)
		if (start.verse != -1) return Ref.parse(book + end);

		// Subcase: start doesn't have a verse, so end's single number refers to chapter (bk1-2)
		if (start.chapter == -1) return;
		return Ref.parse(book + start.chapter + ':' + end);
	}

	/** Returns true if the start of a potential ref range is before or equals its potential end. */
	static isValidOrder(start, end) {
		if (start.book != end.book) return start.order(end) != 1;

		// Comparing using the order method may be invalid if the specificity is mixed:
		// Case: first is more specified (jn1[:7]-jn, jn1:7-[jn]1)
		// Case: second is more specified (jn-[jn]1[:7], jn1-[jn]1:7)
		if ((start.chapter == -1 || end.chapter == -1)
			&& (start.chapter != -1 || end.chapter != -1)) {
			return true;
		}
		if ((start.verse == -1 || end.verse == -1)
			&& (start.verse != -1 || end.verse != -1)) {
			return start.chapter <= end.chapter;
		}

		return start.order(end) != 1;
	}

	/**
	 * Returns an ordered list of non-overlapping existing ref ranges, or undefined if invalid.
	 */
	static parseMultiple(str, delimiter = ' ') {
		let original = str.trim().split(delimiter).map(RefRange.parse);
		if (original.some(rr => !rr)) return;

		return RefRange.makeNonTouching(original);
	}

	static makeNonTouching(refRanges) {
		let byStart = refRanges.sort((a, b) => a.start.order(b.start));
		let out = [];
		while (byStart.length) {
			let left = byStart.splice(0, 1)[0];
			let right = byStart[0];
			if (right && left.touches(right)) {
				left = left.union(right);
				byStart[0] = left;
			} else {
				out.push(left);
			}
		}
		return out;
	}

	static containingTkis(book, tkis) {
		let sorted = tkis.sort((a, b) => a - b);
		return new RefRange(
			Ref.containingTki(book, sorted[0]), Ref.containingTki(book, sorted.slice(-1)[0]));
	}

	constructor(start, end) {
		this.start = start;
		this.end = end;
		if (!RefRange.isValidOrder(start, end)) {
			throw new Error('Out of order ref range: ' + this);
		}
		Object.freeze(this);
	}

	equals(other) {
		if (!other) return false;
		return this.start.equals(other.start) && this.end.equals(other.end);
	}

	toString() {
		if (this.start.equals(this.end)) return '' + this.start;
		if (this.start.book != this.end.book) return this.start + '-' + this.end;

		return this.start + '-' + this.end.chapterAndVerse;
	}

	snapToExisting(bible) {
		return new RefRange(
			this.start.snapToExisting(bible, false),
			this.end.snapToExisting(bible, true));
	}

	isWithinSingleBook() {
		return this.start.book == this.end.book;
	}

	limitToSingleBook() {
		if (this.start.book == this.end.book) return this;
		return new RefRange(this.start, new Ref(this.start.book, -1, -1));
	}

	exists(bible) {
		return this.start.exists(bible) && this.end.exists(bible);
	}

	/** Returns true if these overlap or if there are no verses in between them. */
	touches(bible, other) {
		let byStart = [this.snapToExisting(bible), other.snapToExisting(bible)]
			.sort((a, b) => a.start.order(b.start));
		if (byStart[0].end.order(byStart[1].start) < 1) return true;

		if (byStart[0].end.seek(bible) && byStart[0].end.seek(bible).equals(byStart[1].start))
			return true;

		if (byStart[0].end.endsBook(bible) && byStart[1].start.startsBook(bible)
			&& books.codes.indexOf(byStart[0].end.book) + 1
				== books.codes.indexOf(byStart[1].start.book))
			return true;

		return false;
	}

	union(other) {
		return new RefRange(
			this.start.order(other.start) < 0 ? this.start : other.start,
			this.end.order(other.end) < 0 ? this.end : other.end);
	}
}