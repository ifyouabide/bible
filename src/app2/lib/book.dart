import 'package:flutter/material.dart' hide Flow;

class Book {
  Book(this.json);

  final Map<String, dynamic> json;

  Iterable<Flow> get flows sync* {
    List<dynamic> tokens = json['tokens'];
    final refTkiIter = (json['refs'] as Map<String, dynamic>).entries.iterator;

    if (tokens.isEmpty) return;
    if (!tokens[0].containsKey('layout') || tokens[0]['layout'] is String)
      throw FormatException('First token must describe flow');

    var accumRefs = <MapEntry<String, int>>[];
    num nextRefTki =
        refTkiIter.moveNext() ? refTkiIter.current.value : double.infinity;
    considerAddingRef(int tkIdx) {
      if (tkIdx < nextRefTki) return;

      accumRefs.add(MapEntry<String, int>(
          refTkiIter.current.key, refTkiIter.current.value));
      if (refTkiIter.moveNext()) {
        nextRefTki = refTkiIter.current.value;
      } else {
        nextRefTki = double.infinity;
      }
    }

    considerAddingRef(0);

    int lastLayoutIdx = 0;
    create(int tkIdx) {
      final flow = Flow(
        tokens[lastLayoutIdx]['layout'],
        tokens.sublist(lastLayoutIdx + 1, tkIdx),
        lastLayoutIdx + 1,
        accumRefs,
      );
      accumRefs = [];
      return flow;
    }

    for (int tkIdx = 1; tkIdx < tokens.length; tkIdx++) {
      considerAddingRef(tkIdx);
      Map<String, dynamic> tk = tokens[tkIdx];
      if (tk.containsKey('layout') && tk['layout'] is! String) {
        yield create(tkIdx);
        lastLayoutIdx = tkIdx;
      }
    }
    yield create(tokens.length);
  }
}

const superscript = {
  '0': '\u2070',
  '1': '\u00B9',
  '2': '\u00B2',
  '3': '\u00B3',
  '4': '\u2074',
  '5': '\u2075',
  '6': '\u2076',
  '7': '\u2077',
  '8': '\u2078',
  '9': '\u2079',
};

class Flow {
  Flow(Map<String, dynamic> layoutTk, this.tokens, this.tkiStart, this.refs)
      : type = layoutTk.keys.first,
        indent = layoutTk.values.first;

  final String type;
  final int indent;
  final List<dynamic> tokens;
  final int tkiStart;
  final List<MapEntry<String, int>> refs;

  Iterable<TextSpan> get textSpans sync* {
    int tki = tkiStart;
    int refIdx = 0;
    for (final tk in tokens) {
      if (refIdx < refs.length) {
        if (tki == refs[refIdx].value) {
          yield TextSpan(
              text: refs[refIdx]
                  .key
                  .split(":")[1]
                  .split("")
                  .map((c) => superscript[c])
                  .join(""),
              style: TextStyle(fontSize: 12, color: Colors.grey));
          refIdx++;
        }
      }
      if (tk.containsKey("word")) {
        yield TextSpan(text: tk['word']);
      } else if (tk.containsKey("punctuation")) {
        yield TextSpan(text: tk["punctuation"]);
      } else if (tk.containsKey("layout")) {
        final layout = tk["layout"];
        if (layout == "space") {
          yield TextSpan(text: " ");
        }
      }
      tki++;
    }
  }
}

final bookCodeToName = const {
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
