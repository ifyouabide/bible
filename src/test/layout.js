import * as bibleUi from '../app/bible_ui.js';
import * as resources from '../app/resources.js';

resources.onLoad.then(() => {
  let elem = document.createElement('div');

  for (let bkCode in resources.bible) {
    let bk = resources.bible[bkCode];
    let [html, startTkiToTokens] = bibleUi.makeFixedLayout(bk, [0, bk['tokens'].length], 500);
    for (let tokens of Object.values(startTkiToTokens)) {
      if (tokens.map(tk => tk.width || 0).reduce((a, b) => a + b, 0) > 500) {
        console.error('long', tokens);
        return;
      }
      for (let token of tokens) {
        if (typeof(token) === 'object' && token.width === undefined) {
          console.error(token);
          return;
        }
      }
    } 
  }
  console.log('success');
});