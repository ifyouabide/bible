let ifyouabide = {
	bible: 'kjv',
	bibleLink: 'https://en.wikipedia.org/wiki/King_James_Version',
	welcome: 'Welcome to ifyouabide.org',
	about: `
		<h4>About</h4>
		<div style="margin-left:1rem;">
			The King James Version (1769) is in the public domain, except in the UK where the copyright
			is held by the Crown of England.
			The Strong's numbers in the OT were obtained from <a target="_blank" rel="noopener" href="http://www.bf.org">The Bible Foundation</a>.
			The NT Strong's data was obtained from The KJV2003 Project at <a target="_blank" rel="noopener" href="http://www.crosswire.org">CrossWire</a>.
			See <a target="_blank" rel="noopener" href="http://www.crosswire.org/sword/modules/ModInfo.jsp?modName=KJV">here</a>
			for more information.
			<br/><br/>
			Questions about this reader? Email <a href="mailto:ifyouabide@googlegroups.com">ifyouabide@googlegroups.com</a>
			<br/>
			See our <a target="_blank" rel="noopener" href="https://github.com/kenkania/bible">open source project</a> on GitHub.
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
			The Literal Standard Version of The Holy Bible (LSV) is a registered copyright of
			Covenant Press and the Covenant Christian Coalition (©2020).
			The LSV has a permissive copyright: all non-commercial use is permissible as long as the text is unaltered.
			See <a target="_blank" rel="noopener" href="https://www.lsvbible.com">lsvbible.com</a> for more information.
			<br/><br/>
			Questions about this reader? Email <a href="mailto:ifyouabide@googlegroups.com">ifyouabide@googlegroups.com</a>
			<br/>
			See our <a target="_blank" rel="noopener" href="https://github.com/kenkania/bible">open source project</a> on GitHub.
		</div>
	`,
};

let settings = {
	'ifyouabide': ifyouabide,
	'lsvbible': lsvbible,
};

export default settings[window['app'] || new URLSearchParams(location.search).get('app') || 'ifyouabide'];