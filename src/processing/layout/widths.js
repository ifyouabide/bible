import {onLoad} from '../../common/utils.js';

let g_container = document.createElement('div');
export { g_container as containerElem };

onLoad().then(() => {
	g_container.style.position = 'fixed';
	g_container.style.visibility = 'hidden';
	document.body.appendChild(g_container);
});

export function getWidth(str, {fontFamily, fontSize, iterations=1}) {
	for (let i = 0; i < iterations; i++) {
		let elem = document.createElement('span');
		elem.style.fontFamily = fontFamily;
		elem.style.fontSize = fontSize;
		elem.innerText = str;

		g_container.appendChild(elem);
	}
	let width = g_container.offsetWidth / iterations;
	g_container.innerHTML = '';
	return width;
}