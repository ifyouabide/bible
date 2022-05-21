# LSV

Literal Standard Version, First Edition, of the Holy Bible Containing the Old and New Testaments.  
Copyright © 2020 by Covenant Press of the Covenant Christian Coalition (www.ccc.one)

From:
| File | Source |
| --- | --- |
| The Holy Bible (LSV).pdf | Supplied by the LSV team (latest update at May 20 2022) |
| lsv_raw.txt | The above PDF (pages 11 - 764) converted to text (see below) |
| lsv.txt | Some manual non-content changes (remove page between OT/NT, add ===== for book dividers, remove page numbers/dividers, add trailing space for 5 lines without such) |
| favicon.ico | https://www.lsvbible.com/favicon.ico |

## About/License

*From the publisher ([link](https://www.lsvbible.com/p/get-lsv.html)):*

The first edition of the Literal Standard Version went live on February 2, 2020 and since then the LSV team has been seeking to make this groundbreaking translation available to more readers in more and various formats at as low a cost as possible, because God's word should be delivered without profit motive to those from every walk of life. “Freely you received, freely give.” The LSV will always be offered for free in digital format, but some formats have production and delivery costs and you can help support our ministry when you purchase the LSV in one of these formats.

The Literal Standard Version of The Holy Bible is a registered copyright of Covenant Press and the Covenant Christian Coalition (© 2020), but has been subsequently released under the Creative Commons Attribution-ShareAlike license (CC BY-SA) per our desire to provide God’s word freely. Covenant Press requests that the text remain unaltered in the English language and that translations based on the LSV maintain the same spirit of faithfulness to the original Hebrew, Aramaic, and Greek text. Attribution of minor citations for personal or non-commercial use can be provided as simply “LSV” or “Literal Standard Version.” Citations for commercial use, or distribution of the entire LSV Bible or entire book(s) of the LSV Bible, must be fully attributed and include both “Literal Standard Version (LSV)” and the name of our organization. Covenant Press is soliciting partnerships with Bible publishers that are interested in the LSV project. For queries about partnering with us, please email the translation team at covenantpress@ccc.one. To learn more, visit lsvbible.com. The purpose behind the LSV is to provide readers with a modern, easy-to-read, literal, and accurate translation of the Bible that is free to read, distribute, and translate from. We pray that God will use the LSV to illuminate the hearts and minds of multitudes with the good news that His Son Jesus Christ came in the flesh, died for our sins as a substitutionary sacrifice, rose bodily from the dead, and is coming back again.

## Conversion to txt

PDF was converted to HTML (using pdf2htmlex), after which the text was extracted via JS:

```
roots = Array.from(document.getElementById("page-container").children);
txts = [];
function grab(i) {
  if (i >= roots.length) {
  	console.log(txts.join("====="));
  	return;
  }
  roots[i].scrollIntoView();
  txts.push(roots[i].innerText);
  window.setTimeout(grab, 200, i+1);
}
grab(0);
```
