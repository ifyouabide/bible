let aboutLsv = `
	The Literal Standard Version of The Holy Bible is a registered copyright of Covenant Press and
	the Covenant Christian Coalition (© 2020), but has been subsequently released under the Creative
	Commons Attribution-ShareAlike license
	(<a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank">CC BY-SA</a>)
	per our desire to provide God’s word freely. Covenant Press requests that the text remain
	unaltered in the English language and that translations based on the LSV maintain the same
	spirit of faithfulness to the original Hebrew, Aramaic, and Greek text. Attribution of minor
	citations for personal or non-commercial use can be provided as simply “LSV” or “Literal
	Standard Version.” Citations for commercial use, or distribution of the entire LSV Bible or
	entire book(s) of the LSV Bible, must be fully attributed and include both “Literal Standard
	Version (LSV)” and the name of our organization. Covenant Press is soliciting partnerships
	with Bible publishers that are interested in the LSV project. For queries about partnering
	with us, please email the translation team at <a href="mailto:CovenantPress@ccc.one">
	covenantpress@ccc.one</a>. To learn more, visit
	<a rel="noopener" href="https://www.lsvbible.com">lsvbible.com</a>. The purpose behind the LSV
	is to provide readers with a modern, easy-to-read, literal, and accurate translation of the
	Bible that is free to read, distribute, and translate from. We pray that God will use the LSV to
	illuminate the hearts and minds of multitudes with the good news that His Son Jesus Christ came
	in the flesh, died for our sins as a substitutionary sacrifice, rose bodily from the dead,
	and is coming back again.
`;

let originalCredits = `
	The mapping to Strong's numbers was derived from the
	<a rel="noopener" href="http://www.crosswire.org/sword/modules/ModInfo.jsp?modName=KJV">KJV module</a>
	published by
	<a rel="noopener" href="http://www.crosswire.org">CrossWire</a>
	(with contributions from <a rel="noopener" href="http://www.bf.org">The Bible Foundation</a>).
	<br/><br/>
	The lexicon of Strongs for Hebrew/Greek, as well as intermediate data for constructing
	the mapping to Strong's, was derived from the
	<a href="https://www.STEPBible.org">STEP Bible</a>
	<a href="https://tyndale.github.io/STEPBible-Data/">data</a> from
	<a href="https://www.TyndaleHouse.com">Tyndale House, Cambridge</a>.
`;

let ifyouabide = {
	bible: 'lsv',
	bibleLink: 'https://www.lsvbible.com',
	welcome: 'Welcome to ifyouabide.org',
	about: `
		<h4>About</h4>
		<div style="margin-left:1rem;">
			We are a free, fast, and minimalist Bible reader with search capabilities, based on
			the Literal Standard Version (LSV).
			<br/><br/>
			Questions/comments? Email <a href="mailto:ifyouabide@googlegroups.com">ifyouabide@googlegroups.com</a>
			<br/>
			We are an
			<a rel="noopener" href="https://github.com/kenkania/bible">open source project</a>.
		</div>
		<h4>Credits</h4>
		<div style="margin-left:1rem;">
			${aboutLsv}
			<br/><br/>
		</div>
	`,
};

let lsvbible = {
	bible: 'lsv',
	bibleLink: 'https://www.lsvbible.com',
	welcome: 'Welcome to the LSV Bible Reader',
	about: `
		<h4>About</h4>
		<div style="margin-left:1rem;">
			${aboutLsv}
		</div>
	`,
};

let settings = {
	'ifyouabide': ifyouabide,
	'lsvbible': lsvbible,
};

export default (() => {
	if (typeof(window) != 'undefined')
		return settings[window['app'] || new URLSearchParams(location.search).get('app') || 'ifyouabide'];
	else
		return settings;
})();