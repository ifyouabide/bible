import 'dart:io';
import 'text.dart' as text;
import 'dart:convert';

const THIRD_PARTY_DIR = 'third_party';

void main() {
  final vts = Directory("third_party/lsv")
      .listSync()
      .where((f) => f is File && f.path.endsWith('.usfm'))
      .map((f) => (f as File).readAsStringSync())
      .map((contents) => processUsfm(contents))
      .map((book) => text.toVerseText(book))
      .toList();

  vts.sort((a, b) => iyaBookIdOrder[a.key]! - iyaBookIdOrder[b.key]!);

  final bible = {for (var vt in vts) vt.key: vt.value};
  File('out.json')
      .writeAsStringSync(JsonEncoder.withIndent('\t').convert(bible));
}

class ParserState {
  int? chapter;
  int? verse;
  var italic = false;
  var bold = false;
  var space = false;
}

text.Book processUsfm(String contents) {
  contents += ' ';
  contents = contents.replaceAll('— ', '—');
  contents = contents.replaceAll(' ]', ']');
  contents = contents.replaceAll('[ ', '[');
  contents = contents.replaceAll(' || ', '\\q ');
  contents = contents.replaceAll('\\+w', '\\w'); // ps2:12
  var cIdx = 0;

  final state = ParserState();
  final tokens = <text.Token>[];
  final chapterVerses = <MapEntry<text.ChapterVerse, int>>[];

  int forwardInt() {
    final start = cIdx;
    while (cIdx < contents.length) {
      if (!isDigit(contents[cIdx])) {
        break;
      }
      cIdx++;
    }
    return int.parse(contents.substring(start, cIdx));
  }

  String forwardThrough(List<String> sList) {
    final startIdx = cIdx;
    while (cIdx < contents.length) {
      for (String s in sList) {
        if (cIdx + s.length - 1 >= contents.length) {
          continue;
        }
        if (contents.substring(cIdx, cIdx + s.length) == s) {
          cIdx += s.length;
          return contents.substring(startIdx, cIdx - s.length);
        }
      }
      cIdx++;
    }
    throw Exception('never found "' + sList.toString() + '"');
  }

  void maybeSkipWhitespace() {
    while (cIdx < contents.length) {
      if (contents[cIdx].trim().isNotEmpty) {
        break;
      }
      cIdx++;
    }
  }

  String? bookId;

  while (cIdx < contents.length) {
    final c = contents[cIdx++];
    if (c == '\\') {
      cIdx--;
      final tag = Tag.parseWithin(contents, cIdx);
      cIdx += tag.toString().length;
      switch (tag.type) {
        case 'id':
          bookId = usfmToIyaBookId[contents.substring(cIdx + 1, cIdx + 4)]!;
          print(bookId);
          forwardThrough(['\n']);
          break;
        case 'c':
          cIdx++;
          state.chapter = forwardInt();
          forwardThrough(['\n']);
          break;
        case 'v':
          if (state.space) {
            state.space = false;
            tokens.add(text.Space());
          }
          maybeSkipWhitespace();
          state.verse = forwardInt();
          maybeFixPsalmPrescript(tokens,
              text.Ref(bookId!, state.chapter!, state.verse!), chapterVerses);
          chapterVerses.add(MapEntry(
              text.ChapterVerse(state.chapter!, state.verse!), tokens.length));
          maybeSkipWhitespace();
          break;
        case 'w':
          if (state.space) {
            state.space = false;
            tokens.add(text.Space());
          }
          final word = text.Word(forwardThrough(['\\w*']).split('|')[0].trim());
          tokens.add(word);
          break;
        /* Layout */
        case 'p':
          //tokens.add(text.NewParagraph(0));
          forwardThrough(['\n']);
          break;
        case 'q':
          tokens.add(text.NewLine(tag.number != null ? tag.number! - 1 : 0));
          maybeSkipWhitespace();
          break;
        case 'bd':
          state.bold = !tag.end;
          // ro16:24 <\bd [[>
          // ro16:24 <Amen.\bd ]]\bd* >
          if (!tag.end) {
            maybeSkipWhitespace();
          }
          break;
        case 'it':
          state.italic = !tag.end;
          if (!tag.end) {
            maybeSkipWhitespace();
          }
          break;
        case 'ide':
        case 'h':
        case 'toc':
        case 'mt':
          forwardThrough(['\n']);
          break;
        default:
          throw Exception('unknown tag: ' +
              tag.type +
              ' ' +
              text.Ref(bookId!, state.chapter!, state.verse!).toString());
      }
    } else if (c == ' ') {
      state.space = true;
    } else if (c == '\n') {
    } /*else if (text.Punctuation.all.contains(c)) {
      // jude1:1 <[\w the> (otherwise need to check for \ in raw below)
      if (state.space) {
        state.space = false;
        tokens.add(text.Space());
      }
      tokens.add(text.Punctuation(c));
    } */
    else {
      if (state.space) {
        state.space = false;
        tokens.add(text.Space());
      }
      // 1jn2:7 <beginning—\w the>
      final stroke = c + forwardThrough([' ', '\\', '\n']);
      cIdx--;
      tokens.addAll(text.GraphemeToken.split(stroke, false));
    }
  }

  return text.Book(bookId!, tokens, chapterVerses);
}

class Tag {
  final String type;
  final int? number;
  final bool end;

  Tag(this.type, this.number, this.end);
  static Tag parse(String s) {
    s = s.substring(1);
    bool end = s.endsWith('*');
    if (end) {
      s = s.substring(0, s.length - 1);
    }
    String? type;
    int? number;
    for (var i = 2; i < s.length; i++) {
      if (isDigit(s[i])) {
        number = int.parse(s.substring(i));
        type = s.substring(0, i);
        break;
      }
    }
    return Tag(type == null ? s : type, number, end);
  }

  String toString() {
    return '\\' +
        type +
        (number != null ? number.toString() : '') +
        (end ? '*' : '');
  }

  static Tag parseWithin(String contents, int idx) {
    var startIdx = idx;
    idx += 2;
    while (idx < contents.length) {
      final c = contents[idx];
      if (!isAlphaNumeric(c)) {
        return Tag.parse(
            contents.substring(startIdx, idx + (c == '*' ? 1 : 0)));
      }
      idx++;
    }
    throw Exception('never finished tag ' + contents.substring(idx));
  }
}

bool isAlphaNumeric(String s) {
  int rune = charToRune(s);
  return isDigit(s) ||
      (rune >= 65 && rune <= 90) ||
      (rune >= 97 && rune <= 122);
}

bool isDigit(String s) {
  return charToRune(s) >= charToRune('0') && charToRune(s) <= charToRune('9');
}

int charToRune(String s) {
  return s.runes.first;
}

void maybeFixPsalmPrescript(List<text.Token> tokens, text.Ref ref,
    List<MapEntry<text.ChapterVerse, int>> chapterVerses) {
  if (ref.book == 'ps' &&
      ref.verse == 2 &&
      psalmsWithPrescripts.contains(ref.chapter)) {
    final chV1 = chapterVerses.removeLast();
    final v1Idx = getPsalmV1Idx(ref, tokens.sublist(chV1.value)) + chV1.value;
    chapterVerses.add(MapEntry(text.ChapterVerse(ref.chapter, 0), chV1.value));
    chapterVerses.add(MapEntry(text.ChapterVerse(ref.chapter, 1), v1Idx));
  }
}

int getPsalmV1Idx(text.Ref ref, List<text.Token> tokens) {
  int? lastIdx;
  for (var i = 0; i < tokens.length; i++) {
    final tk = tokens[i];
    if (tk is text.Word && tk.word.toUpperCase() != tk.word) {
      return lastIdx!;
    }
    if (tk is text.Punctuation && <String>{'.', ':'}.contains(tk.punctuation)) {
      lastIdx = i + 1;
      while (lastIdx! < tokens.length) {
        if (tokens[lastIdx++] is text.Space) {
          break;
        }
      }
    }
  }
  throw Exception('unable to find prescript');
}

const iyaBookIdOrder = {
  'ge': 1,
  'ex': 2,
  'le': 3,
  'nu': 4,
  'de': 5,
  'jos': 6,
  'jg': 7,
  'ru': 8,
  '1sa': 9,
  '2sa': 10,
  '1ki': 11,
  '2ki': 12,
  '1ch': 13,
  '2ch': 14,
  'ezr': 15,
  'ne': 16,
  'es': 17,
  'jb': 18,
  'ps': 19,
  'pr': 20,
  'ec': 21,
  'so': 22,
  'is': 23,
  'je': 24,
  'la': 25,
  'ek': 26,
  'da': 27,
  'ho': 28,
  'jl': 29,
  'am': 30,
  'ob': 31,
  'jon': 32,
  'mi': 33,
  'na': 34,
  'hk': 35,
  'zp': 36,
  'hg': 37,
  'zc': 38,
  'ml': 39,
  'mt': 40,
  'mk': 41,
  'lk': 42,
  'jn': 43,
  'ac': 44,
  'ro': 45,
  '1co': 46,
  '2co': 47,
  'ga': 48,
  'ep': 49,
  'pp': 50,
  'co': 51,
  '1th': 52,
  '2th': 53,
  '1ti': 54,
  '2ti': 55,
  'ti': 56,
  'phm': 57,
  'he': 58,
  'ja': 59,
  '1pe': 60,
  '2pe': 61,
  '1jn': 62,
  '2jn': 63,
  '3jn': 64,
  'jude': 65,
  're': 66,
};

const usfmToIyaBookId = {
  'GEN': 'ge',
  'EXO': 'ex',
  'LEV': 'le',
  'NUM': 'nu',
  'DEU': 'de',
  'JOS': 'jos',
  'JDG': 'jg',
  'RUT': 'ru',
  '1SA': '1sa',
  '2SA': '2sa',
  '1KI': '1ki',
  '2KI': '2ki',
  '1CH': '1ch',
  '2CH': '2ch',
  'EZR': 'ezr',
  'NEH': 'ne',
  'EST': 'es',
  'JOB': 'jb',
  'PSA': 'ps',
  'PRO': 'pr',
  'ECC': 'ec',
  'SNG': 'so',
  'ISA': 'is',
  'JER': 'je',
  'LAM': 'la',
  'EZK': 'ek',
  'DAN': 'da',
  'HOS': 'ho',
  'JOL': 'jl',
  'AMO': 'am',
  'OBA': 'ob',
  'JON': 'jon',
  'MIC': 'mi',
  'NAM': 'na',
  'HAB': 'hk',
  'ZEP': 'zp',
  'HAG': 'hg',
  'ZEC': 'zc',
  'MAL': 'ml',
  'MAT': 'mt',
  'MRK': 'mk',
  'LUK': 'lk',
  'JHN': 'jn',
  'ACT': 'ac',
  'ROM': 'ro',
  '1CO': '1co',
  '2CO': '2co',
  'GAL': 'ga',
  'EPH': 'ep',
  'PHP': 'pp',
  'COL': 'co',
  '1TH': '1th',
  '2TH': '2th',
  '1TI': '1ti',
  '2TI': '2ti',
  'TIT': 'ti',
  'PHM': 'phm',
  'HEB': 'he',
  'JAS': 'ja',
  '1PE': '1pe',
  '2PE': '2pe',
  '1JN': '1jn',
  '2JN': '2jn',
  '3JN': '3jn',
  'JUD': 'jude',
  'REV': 're',
};

const psalmsWithPrescripts = {
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  24,
  25,
  26,
  27,
  28,
  29,
  30,
  31,
  32,
  34,
  35,
  36,
  37,
  38,
  39,
  40,
  41,
  42,
  44,
  45,
  46,
  47,
  48,
  49,
  50,
  51,
  52,
  53,
  54,
  55,
  56,
  57,
  58,
  59,
  60,
  61,
  62,
  63,
  64,
  65,
  66,
  67,
  68,
  69,
  70,
  72,
  73,
  74,
  75,
  76,
  77,
  78,
  79,
  80,
  81,
  82,
  83,
  84,
  85,
  86,
  87,
  88,
  89,
  90,
  92,
  98,
  100,
  101,
  102,
  103,
  108,
  109,
  110,
  120,
  121,
  122,
  123,
  124,
  125,
  126,
  127,
  128,
  129,
  130,
  131,
  132,
  133,
  134,
  138,
  139,
  140,
  141,
  142,
  143,
  144,
  145
};
