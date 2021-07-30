import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart' hide Flow;
import 'package:flutter/services.dart';

import 'book.dart';

void main() {
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Demo',
      theme: ThemeData(
        primarySwatch: Colors.blue,
      ),
      home: Scaffold(
        body: MainPanel(),
      ),
    );
  }
}

class MainPanel extends StatefulWidget {
  @override
  _MainPanelState createState() => _MainPanelState();
}

class _MainPanelState extends State<MainPanel> {
  _MainPanelState() {
    final file = File('../../../bible/esv.json');
    Map<String, dynamic> json = jsonDecode(file.readAsStringSync());
    books = json.map((key, value) => MapEntry<String, Book>(key, Book(value)));
    book = books['phm'];
  }

  Map<String, Book> books;
  Book book;

  @override
  Widget build(BuildContext context) {
    return RawKeyboardListener(
      focusNode: FocusNode(),
      onKey: (RawKeyEvent event) {
        if (event.logicalKey == LogicalKeyboardKey.keyG) {}
      },
      child: Stack(children: [
        BookView(book: book),
        Center(
            child: Container(
                width: 100,
                decoration: BoxDecoration(
                  border: Border.all(
                    width: 1,
                    color: Colors.black,
                  ),
                  color: Colors.white,
                ),
                padding: const EdgeInsets.only(
                    top: 10, bottom: 10, left: 10, right: 10),
                child: TextField(
                    cursorColor: Colors.black,
                    decoration: null,
                    onChanged: (text) {
                      if (text.length < 2) return;
                      if (books.containsKey(text) && book != books[text]) {
                        setState(() {
                          book = books[text];
                        });
                      }
                    }))),
      ]),
    );
  }
}

class BookView extends StatelessWidget {
  BookView({Key key, this.book}) : super(key: key);

  final Book book;

  @override
  Widget build(BuildContext context) {
    final flows = List.from(book.flows, growable: false);
    return Container(
      width: 550,
      padding: EdgeInsets.symmetric(horizontal: 15),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.black, width: .2),
        borderRadius: BorderRadius.circular(4),
      ),
      child: ListView.builder(
        itemCount: flows.length + 2,
        itemBuilder: (context, idx) {
          if (idx == 0) {
            return SizedBox(height: 100);
          } else if (idx == flows.length + 1) {
            return SizedBox(height: 500);
          }
          return FlowView(flow: flows[idx - 1]);
        },
      ),
    );
  }
}

class FlowView extends StatelessWidget {
  FlowView({Key key, this.flow}) : super(key: key);

  final Flow flow;

  @override
  Widget build(BuildContext context) {
    print('build the flow $this');

    final stringToWidth = CreateStringWidthMap([
      ...Set.of(flow.tokens.map((tk) {
        if (tk.containsKey("word")) {
          return tk['word'];
        } else if (tk.containsKey("punctuation")) {
          return tk['punctuation'];
        }
        return " ";
      })),
      ...List.generate(
          150,
          (i) =>
              (i + 1).toString().split('').map((c) => superscript[c]).join("")),
    ]);
    final lines = <Widget>[];
    const lineWidth = 500;
    final indent = flow.indent * 30;

    if (flow.type != "newLine") {
      var accumWidgets = <TextSpan>[];
      int accumWidth = indent;

      void endLine(bool justify) {
        lines.add(DisplayLine(
            justify: justify,
            indent: (lines.isEmpty || flow.type == "newBlock") ? indent : 0,
            children: accumWidgets));
        accumWidgets = [];
        accumWidth = (flow.type == "newBlock") ? indent : 0;
      }

      flow.textSpans.forEach((TextSpan span) {
        int width = stringToWidth[span.text];
        if (accumWidth + width > lineWidth) {
          endLine(true);
        }
        accumWidgets.add(span);
        accumWidth += width;
      });
      if (accumWidgets.isNotEmpty) {
        endLine(false);
      }
    } else {
      lines.add(DisplayLine(indent: indent, children: List.of(flow.textSpans)));
    }

    return Column(
      children: lines,
      //crossAxisAlignment: CrossAxisAlignment.stretch,
    );
  }
}

class DisplayLine extends StatelessWidget {
  DisplayLine({Key key, this.justify = false, this.indent, this.children})
      : super(key: key);

  final bool justify;
  final int indent;
  final List<TextSpan> children;

  @override
  Widget build(BuildContext context) {
    final s = <InlineSpan>[
      if (indent > 0) WidgetSpan(child: SizedBox(width: indent.toDouble())),
      ...children,
      TextSpan(text: " "),
      WidgetSpan(
        child: SizedBox(width: 500, height: 0),
      ),
    ];
    return Text.rich(
      TextSpan(
        children: s,
      ),
      maxLines: 2,
      overflow: TextOverflow.visible,
      textAlign: justify ? TextAlign.justify : TextAlign.left,
    );
  }
}

Map<String, int> CreateStringWidthMap(Iterable<String> strings) {
  final map = Map<String, int>();
  for (final str in strings) {
    final painter = TextPainter(
        text: TextSpan(text: str), textDirection: TextDirection.ltr);
    painter.layout();
    map[str] = painter.width.round();
  }
  return map;
}

/*
class BookView extends StatelessWidget {
  BookView({Key key, this.book}) : super(key: key);

  final Book book;

  @override
  Widget build(BuildContext context) {
    final flows = List.from(book.flows, growable: false);
    return Center(
      child: Scrollbar(
        child: ListView.builder(
          padding: const EdgeInsets.all(8),
          itemCount: flows.length,
          itemBuilder: (context, idx) {
            return Container(
              //height: 50,
              //color: Colors.blue,
              child: FlowView(flow: flows[idx]),
            );
          },
        ),
      ),
    );
  }
}

class FlowView extends StatelessWidget {
  FlowView({Key key, this.flow}) : super(key: key);

  final Flow flow;

  @override
  Widget build(BuildContext context) {
    print('build the flow $this');
    var children = List<Widget>.from(flow.tokens.map((dynamic tk) {
      if (tk.containsKey("word")) {
        return Text(tk['word']);
      } else if (tk.containsKey("punctuation")) {
        return Text(tk['punctuation']);
      }
      return null;
    }).where((element) => element != null));
    return Wrap(
      spacing: 3,
      runSpacing: 0,
      children: children,
    );
  }
}
*/
