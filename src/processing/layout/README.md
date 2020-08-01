# Layout

We compute the width of every word/lemma/punctuation, which is used in rendering.

This computation is done manually, by opening layout.html, and then copying the results
into layout.json, and then brotli compressing into layout.json.br (which is used by the build
system).