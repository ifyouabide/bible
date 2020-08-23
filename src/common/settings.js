let aboutLsv = `
	The Literal Standard Version of The Holy Bible (LSV) is a registered copyright of
	Covenant Press and the Covenant Christian Coalition (©2020).
	The LSV has a permissive copyright: all non-commercial use is permissible as long as the text is unaltered.
	See <a rel="noopener" href="https://www.lsvbible.com">lsvbible.com</a> for more information.
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
	original: 'olsv',
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