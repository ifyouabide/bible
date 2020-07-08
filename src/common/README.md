# Common

A bible is a list of books. Note, we generally use the Bible [book codes](book_codes.md) instead
of names. We use UTF-8 encoding for files.

## Bible Formats

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
  "notes": [
    "jn1:1",
  ],
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
    // Computed:
    "aTokensMap": {
      "0": 0,
      "1": 0,
      "2": 1,
    },
    // Computed:
    "bTokensMap": {
      "0": 0,
      "1": 1,
      "2": 1,
    },
  },
}
```

### Verse Text Format

Bibles can be represented in a verse and text-centric JSON format that looks like:

```json
{
  "ge": {
    "1:1": "\nIn [the] beginning|0|, God created the heavens and the earth.",
  },
  "notes": [
    "jn1:1",
  ],
}
```

Each verse can have these recognized text markings:
* [word] to represent a word without a corresponding word in the original text
* [[phrase]] for a phrase whose inclusion is disputed
* |number| to link to an embedded note
* \n for a paragraph
* \t or || for a line (of poetry), \t\t for double indent
* \f for a blank line
* \r for an explicit line end