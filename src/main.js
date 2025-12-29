import { collatzSequence, unpackSequence } from './collatz.js';
import playSvg from './assets/image/play.svg?raw';
import pauseSvg from './assets/image/pause.svg?raw';

const startBtn = document.querySelector('#start-btn');
const numberSlider = document.querySelector('#number-slider');
const numberDisplay = document.querySelector('#number-display');
const tempoSlider = document.querySelector('#tempo-slider');
const tempoDisplay = document.querySelector('#tempo-display');
const presetRadios = document.querySelectorAll('input[name="preset"]');
const loadingDialog = document.querySelector('#loading-dialog');

startBtn.innerHTML = playSvg;

let audioContext = null;
const audioSamples = {
	1: {},
	2: {},
	3: {},
	4: {},
};
const audioArrayBuffers = {
	1: {},
	2: {},
	3: {},
	4: {},
};
const N_CONCURRENT_SAMPLES = 3;
let isPlaying = false;
let currentTimeout = null;
let currentSequence = [];
let currentStep = 0;
let currentInstrument = 1;
let instrument4Groups = [];
let playingSources = [];

let tempo = parseInt(tempoSlider.value);

function initializeSettings() {
	// Sync tempo display with slider value
	const initialTempo = parseInt(tempoSlider.value);
	tempo = initialTempo;
	tempoDisplay.textContent = initialTempo;

	// Sync number display with slider value
	const initialNumber = parseInt(numberSlider.value);
	numberDisplay.textContent = initialNumber;

	// Sync current instrument with checked radio button
	const checkedRadio = document.querySelector('input[name="preset"]:checked');
	if (checkedRadio) {
		currentInstrument = parseInt(checkedRadio.value);
	}
}

function debounce(func, delay) {
	let timeoutId;
	return function (...args) {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => func.apply(this, args), delay);
	};
}

function getStepDuration() {
	return (60 / (tempo * 4)) * 1000;
}

async function fetchAudioFile(path) {
	const url = `${import.meta.env.BASE_URL}${path}`;
	const response = await fetch(url);
	return await response.arrayBuffer();
}

async function decodeAudioData(arrayBuffer) {
	return await audioContext.decodeAudioData(arrayBuffer);
}

function playSample(buffer) {
	if (!buffer || !audioContext) return;

	const source = audioContext.createBufferSource();
	source.buffer = buffer;
	source.connect(audioContext.destination);
	source.start();
	return source;
}

function playSampleWithStop(buffer) {
	if (!buffer || !audioContext) return;

	// If we're at the limit, stop the earliest playing source
	if (playingSources.length >= N_CONCURRENT_SAMPLES) {
		const earliestSource = playingSources.shift();
		if (earliestSource) {
			try {
				earliestSource.stop();
			} catch (e) {
				// Source may have already stopped, ignore error
			}
		}
	}

	const source = playSample(buffer);

	// Remove source from array when it finishes playing
	source.onended = () => {
		const index = playingSources.indexOf(source);
		if (index > -1) {
			playingSources.splice(index, 1);
		}
	};

	playingSources.push(source);
}

function groupConsecutiveBits(sequence) {
	const groups = [];
	if (sequence.length === 0) return groups;

	const MAX_LENGTH = 4;
	let i = 0;

	while (i < sequence.length) {
		const currentBit = sequence[i];
		let consecutiveCount = 0;

		while (i < sequence.length && sequence[i] === currentBit && consecutiveCount < MAX_LENGTH) {
			consecutiveCount++;
			i++;
		}

		groups.push({ bit: currentBit, length: consecutiveCount });
	}

	return groups;
}

function getFirstInSequenceIndices(sequence) {
	const indices = new Set();
	if (sequence.length === 0) return indices;

	let i = 0;
	while (i < sequence.length) {
		const currentBit = sequence[i];
		// Mark the first occurrence in this consecutive group
		indices.add(i);

		// Skip to the next different bit
		while (i < sequence.length && sequence[i] === currentBit) {
			i++;
		}
	}

	return indices;
}

function getMelodicSound(bit, length, instrument) {
	const basePath = `audio/${String(instrument).padStart(2, '0')}`;
	if (bit === 0) {
		if (length === 1) return `${basePath}/01.wav`;
		if (length === 2) return `${basePath}/04.wav`;
		if (length === 3) return `${basePath}/07.wav`;
		return `${basePath}/06.wav`;
	} else {
		if (length === 1) return `${basePath}/05.wav`;
		if (length === 2) return `${basePath}/03.wav`;
		if (length === 3) return `${basePath}/08.wav`;
		return `${basePath}/02.wav`;
	}
}

function startSequencer() {
	if (!isPlaying || currentSequence.length === 0) return;

	const stepDuration = getStepDuration();

	if (currentInstrument === 3 || currentInstrument === 4) {
		function playNextGroup() {
			if (!isPlaying || instrument4Groups.length === 0) return;

			const group = instrument4Groups[currentStep];
			const soundFile = getMelodicSound(group.bit, group.length, currentInstrument);
			const buffer = audioSamples[currentInstrument][soundFile];

			if (buffer) {
				playSampleWithStop(buffer);
			}

			const groupDuration = group.length * stepDuration;

			currentStep = (currentStep + 1) % instrument4Groups.length;

			currentTimeout = setTimeout(playNextGroup, groupDuration);
		}

		playNextGroup();
	} else if (currentInstrument === 2) {
		const firstInSequenceIndices = getFirstInSequenceIndices(currentSequence);

		function playNextStep() {
			if (!isPlaying) return;

			const bit = currentSequence[currentStep];
			const isFirstInSequence = firstInSequenceIndices.has(currentStep);

			if (isFirstInSequence) {
				if (bit === 0) {
					playSample(audioSamples[2]['audio/02/kick.wav']);
				} else {
					playSample(audioSamples[2]['audio/02/rim.wav']);
				}
			}

			currentStep = (currentStep + 1) % currentSequence.length;

			currentTimeout = setTimeout(playNextStep, stepDuration);
		}

		playNextStep();
	} else {
		function playNextStep() {
			if (!isPlaying) return;

			const bit = currentSequence[currentStep];

			if (bit === 0) {
				playSample(audioSamples[1]['audio/01/hat.wav']);
			} else {
				playSample(audioSamples[1]['audio/01/kick.wav']);
			}

			currentStep = (currentStep + 1) % currentSequence.length;

			currentTimeout = setTimeout(playNextStep, stepDuration);
		}

		playNextStep();
	}
}

function stopSequencer() {
	isPlaying = false;
	if (currentTimeout) {
		clearTimeout(currentTimeout);
		currentTimeout = null;
	}
	// Stop all playing sources
	playingSources.forEach(source => {
		try {
			source.stop();
		} catch (e) {
			// Source may have already stopped, ignore error
		}
	});
	playingSources = [];
	currentStep = 0;
}

function updateSequence(number) {
	const wasPlaying = isPlaying;
	stopSequencer();

	const packed = collatzSequence(number);
	currentSequence = unpackSequence(packed);
	instrument4Groups = groupConsecutiveBits(currentSequence);

	numberDisplay.textContent = number;

	if (audioContext && wasPlaying) {
		isPlaying = true;
		startSequencer();
	}
}

async function preloadAudioFiles() {
	const audioFiles = [
		['kick.wav', 'hat.wav'],
		['kick.wav', 'rim.wav'],
		['01.wav', '02.wav', '03.wav', '04.wav', '05.wav', '06.wav', '07.wav', '08.wav'],
		['01.wav', '02.wav', '03.wav', '04.wav', '05.wav', '06.wav', '07.wav', '08.wav'],
	].map((arr, instrumentIdx) => arr.map(path => `audio/${String(instrumentIdx + 1).padStart(2, '0')}/${path}`));

	const loadPromises = audioFiles.flatMap((instrumentPaths, instrumentIndex) => {
		const instrument = instrumentIndex + 1;
		return instrumentPaths.map(path =>
			fetchAudioFile(path).then(arrayBuffer => {
				audioArrayBuffers[instrument][path] = arrayBuffer;
			})
		);
	});

	await Promise.all(loadPromises);
}

async function decodeAllSamples() {
	// Decode all samples in parallel using full paths as keys
	const decodePromises = Object.keys(audioArrayBuffers).flatMap(instrument => {
		const instrumentNum = parseInt(instrument, 10);
		return Object.keys(audioArrayBuffers[instrumentNum]).map(path =>
			decodeAudioData(audioArrayBuffers[instrumentNum][path]).then(buffer => {
				audioSamples[instrumentNum][path] = buffer;
			})
		);
	});

	await Promise.all(decodePromises);
}

(async () => {
	loadingDialog.classList.remove('hidden');
	try {
		await preloadAudioFiles();
		audioContext = new (window.AudioContext || window.webkitAudioContext)();
		await decodeAllSamples();

		const initialNumber = parseInt(numberSlider.value);
		updateSequence(initialNumber);
	} finally {
		loadingDialog.classList.add('hidden');
	}
})();

startBtn.addEventListener('click', () => {
	if (!audioContext) return;

	if (!isPlaying) {
		isPlaying = true;
		startSequencer();
		startBtn.innerHTML = pauseSvg;
	} else {
		stopSequencer();
		startBtn.innerHTML = playSvg;
	}
});

numberSlider.addEventListener('input', e => {
	const number = parseInt(e.target.value);
	numberDisplay.textContent = number;
	debouncedUpdateSequence(number);
});

const debouncedUpdateSequence = debounce(updateSequence, 100);

tempoSlider.addEventListener('input', e => {
	const newTempo = parseInt(e.target.value);
	tempoDisplay.textContent = newTempo;
	debouncedUpdateTempo(newTempo);
});

const debouncedUpdateTempo = debounce(newTempo => {
	tempo = newTempo;
	if (isPlaying && audioContext) {
		stopSequencer();
		isPlaying = true;
		startSequencer();
	}
}, 500);

presetRadios.forEach(radio => {
	radio.addEventListener('change', e => {
		if (e.target.checked) {
			const wasPlaying = isPlaying;
			currentInstrument = parseInt(e.target.value);
			stopSequencer();
			if (wasPlaying && audioContext) {
				isPlaying = true;
				startSequencer();
			}
		}
	});
});

// Initialize all settings to match input values on page load
initializeSettings();
