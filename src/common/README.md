# Common

A bible is a list of books. Note, we generally use the Bible [book codes](book_codes.md) instead
of names. We generally use UTF-8 encoding for files.

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
* a word is a sequence of non-punctuation characters; instances of *-'’* may be present, if surrounded
  by non-punctuation characters on both sides; *'’* at the end will be considered part of the word
  if followed by \b (this could be improved)
* for layout:
  * the space character ' ' is used for a space token
  * for layout flows:
    * \n for a new line
    * \r for a new block
    * \f for a new paragraph
  * any of the layout flow characters can be followed by one or more \t characters to specify the
    level of indent

## Bible Formats

There are a few main formats:
  * verse text: a map of book codes to books, with each being a map of chapter:verse to tokens (in text representation)
  * verse token: a map of book codes to books, with each being a map of chapter:verse to tokens
  * book token: a map of book codes to books, with each having a list of tokens and map of
    chapter:verse to starting token index

E.g., in JSON:

### Verse Text
```js
{
  "ge": {
    "1:1": "In the beginning, God created the heavens and the earth.",
    // ...
  },
  // ...
}
```

### Verse Token
```js
{
  "ge": {
    "1:1": [
      {"word": "In"},
      {"layout": "space"},
      {"word": "the"},
      // ...
    ],
    // ...
  },
  // ...
}
```

### Book Token
```js
{
  "ge": {
    "tokens": [
      {"word": "In"},
      {"layout": "space"},
      {"word": "the"},
    ],
    "refs": {
      "1:1": 0,
      "1:2": 43,
      // ...
    }
  },
  // ...
}
```

### Bible Map

A bible mapping maps tokens from one bible to another. Per book (or verse), a set of token indices
is associated with a set of token indices of another bible. This mapping may be partial.

```js
{
  "ge": [
      [[0, 1], [0]],
      [[2], [1, 2]],
      // ...
  ],
  // ...
}
```