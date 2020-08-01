# Common

A bible is a list of books. Note, we generally use the Bible [book codes](book_codes.md) instead
of names. We use UTF-8 encoding for files.

## Tokens and Equivalent JSON and Text Format

Most writings can be considered as an ordered list of tokens. We define several types of tokens:

* word
* punctuation
* layout
  * space
  * newLine
    * indicates an end of any current flow and start of a new line with a certain indentation
  * newBlock
    * indicates an end of any current flow and start of a new block with a certain indentation;
      blocks are wrapped to the same level of indentation
  * newParagraph
    * indicates an end of any current flow and start of a new paragraph with a certain indentation;
      paragraphs are wrapped to same level of indentation (although the first line is slightly
      indented)


Tokens have a simple JSON representation, e.g.:

```js
{"word": "Hello"}
{"punctuation": ","}
{"layout": "space"}
{"layout": {"newLine": 1}}
{"layout": {"newBlock": 0}}
{"layout": {"newParagraph": 0}}
{"layout": "endLine"}
```

Tokens also have a simple text representation, using the following rules:

* punctuation is defined as one of the following characters: …,;:.?!-—'‘’"“”(){}[]
* a word is a sequence of characters containing non-punctuation or punctuation preceded by
  non-punctuation (this could be improved)
* for layout:
  * the space character ' ' is used for a space token
  * for layout flows:
    * \n for a new line
    * \r for a new block
    * \f for a new paragraph
  * any of the layout flow characters can be followed by one or more \t characters to specify the
    level of indent

## Bible Formats

Bibles 

### Token Format

Bibles can be represented in a token-centric JSON format that looks like:

```json
{
  "ge": {
    "tokens": [
      {"layout": "new-paragraph"},
      {"note": 0},
      {"word": "In"},
      {"layout": "space"},
      {"word": "the"},
      {"layout": "space"},
      {"word": "beginning"},
      {"punctuation": ","},
    ],
    "refs": {
      "1:1": 0,  // index of the token starting the verse
      "1:2": 23,
    }
  },
}
```

A token is a dictionary that contains exactly one of the following entries:
* *word*: the word as a string
* *punctuation*: the punctuation as a string
* *layout*: one of:
  * "space"
  * "paragraph"
  * "blankLine"
  * {"line": integer indent level}
  * "endLine"
* *note*: index into the embedded note list
* *translation*: one of:
  * {"noOriginal": "begin"/"end"},
  * {"disputed": "begin"/"end"},

A bible mapping maps tokens from one bible to another. Per book, a token index or set of token
indices is associated with a token index or set of token indices of another bible. This mapping
may be partial.

```json
{
  "ge": {
    "map": [
      [[0, 1], 0],
      [2, [1, 2]],
    ],
  },
}
```