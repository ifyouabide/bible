window.addEventListener('DOMContentLoaded', () => {
	fetch('resources/lsv_jn.json')
		.then(response => response.json())
		.then(json => {
			document.getElementById('bible').innerText = JSON.stringify(json);
		});
});