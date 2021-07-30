# App2 (Flutter)

## Layout

We have several desires:
* interlinear
* scrolling to particular word, verse, ch; page up/down
* justified text except on last line of flow
* indentation
* allow inline markers (ch/verse/x-ref/note)
* performance: don't require layout/calculation for content outside view
  (we'll show current chapter vs total instead of computing total height)

We have several impl options:
* scrolling:
  * ListView+ItemBuilder
  * custom sliver thing?
* flow-level:
  * Wrap (not really flexible enough for us)
  * CustomMultiChildLayout


