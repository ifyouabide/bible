import 'dart:collection';

import 'package:equatable/equatable.dart';

abstract class Token {}

abstract class GraphemeToken extends Token {
  static List<GraphemeToken> split(String text, bool quoteOverApostrophe) {
    bool wordEnd(String c, String? c2) {
      if (!Punctuation.all.contains(c)) {
        return false;
      }
      if (!Punctuation(c).maybeApostrophe) {
        return true;
      }
      if (c2 != null && !Punctuation.all.contains(c2)) {
        return false;
      }
      return quoteOverApostrophe;
    }

    final tokens = <GraphemeToken>[];
    int? wordStartIdx;
    for (var idx = 0; idx < text.length; idx++) {
      final c = text[idx];
      final String? c2 = (idx + 1) < text.length ? text[idx + 1] : null;
      if (wordStartIdx != null) {
        if (wordEnd(c, c2)) {
          tokens.add(Word(text.substring(wordStartIdx, idx)));
          wordStartIdx = null;
        }
      }
      if (wordStartIdx == null) {
        if (Punctuation.all.contains(c)) {
          tokens.add(Punctuation(c));
        } else {
          wordStartIdx = idx;
        }
      }
    }
    if (wordStartIdx != null) {
      tokens.add(Word(text.substring(wordStartIdx)));
    }

    return tokens;
  }
}

class Word extends GraphemeToken {
  String word;
  Word(this.word);
}

class Punctuation extends GraphemeToken {
  static const all = <String>{
    '…',
    ',',
    ';',
    ':',
    '.',
    '?',
    '!',
    '-',
    '—',
    '\'',
    '"',
    '‘',
    '’',
    '“',
    '”',
    '(',
    ')',
    '{',
    '}',
    '[',
    ']'
  };

  String punctuation;
  Punctuation(this.punctuation);

  bool get maybeApostrophe => punctuation == '\'' || punctuation == '’';
}

class Space extends Token {}

abstract class LayoutToken extends Token {
  final int indent;
  LayoutToken(this.indent);
}

class NewLine extends LayoutToken {
  NewLine(super.indent);
}

class NewBlock extends LayoutToken {
  NewBlock(super.indent);
}

class NewParagraph extends LayoutToken {
  NewParagraph(super.indent);
}

class Book {
  final String id;
  final List<Token> tokens;
  final List<MapEntry<ChapterVerse, int>> chapterVerses;

  Book(this.id, this.tokens, this.chapterVerses);
}

class ChapterVerse extends Equatable {
  final int chapter;
  final int verse;

  ChapterVerse(this.chapter, this.verse);

  @override
  List<Object> get props => [chapter, verse];

  String toString() => '$chapter:$verse';
}

class Ref extends Equatable {
  final String book;
  final int chapter;
  final int verse;

  Ref(this.book, this.chapter, this.verse);

  @override
  List<Object> get props => [book, chapter, verse];

  String toString() => '$book$chapter:$verse';
}

MapEntry<String, Map<String, String>> toVerseText(Book book) {
  final entries = book.chapterVerses;
  final verses = LinkedHashMap<String, String>();
  for (var i = 0; i < entries.length; i++) {
    final e = entries[i];
    final endTki = i + 1 < entries.length ? entries[i + 1].value : null;
    final tokens = book.tokens
        .sublist(e.value, endTki == null ? book.tokens.length : endTki);
    verses[e.key.toString()] = tokens.map((tk) => toString(tk)).join('');
  }
  return MapEntry(book.id, verses);
}

String toString(Token t) {
  switch (t.runtimeType) {
    case Word:
      return (t as Word).word;
    case Punctuation:
      return (t as Punctuation).punctuation;
    case Space:
      return ' ';
    case NewLine:
      return '\n' + '\t' * (t as NewLine).indent;
    case NewBlock:
      return '\r' + '\t' * (t as NewBlock).indent;
    case NewParagraph:
      return '\f' + '\t' * (t as NewParagraph).indent;
  }
  return '';
}
