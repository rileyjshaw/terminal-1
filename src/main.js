import { collatzSequence, unpackSequence } from './collatz.js';
import playSvg from './assets/image/play.svg?raw';
import pauseSvg from './assets/image/pause.svg?raw';

const startBtn = document.querySelector('#start-btn');
const numberSlider = document.querySelector('#number-slider');
const numberDisplay = document.querySelector('#number-display');
const tempoSlider = document.querySelector('#tempo-slider');
const tempoDisplay = document.querySelector('#tempo-display');
const presetRadios = document.querySelectorAll('input[name="preset"]');

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

async function fetchAudioFile(url) {
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

function getInstrument4Sound(bit, length) {
	if (bit === 0) {
		if (length === 1) return '1.wav';
		if (length === 2) return '4.wav';
		if (length === 3) return '7.wav';
		if (length === 4) return '6.wav';
		return '6.wav';
	} else {
		if (length === 1) return '5.wav';
		if (length === 2) return '3.wav';
		if (length === 3) return '8.wav';
		if (length === 4) return '2.wav';
		return '2.wav';
	}
}

function startSequencer() {
	if (!isPlaying || currentSequence.length === 0) return;

	const stepDuration = getStepDuration();

	if (currentInstrument === 3 || currentInstrument === 4) {
		function playNextGroup() {
			if (!isPlaying || instrument4Groups.length === 0) return;

			const group = instrument4Groups[currentStep];
			const soundFile = getInstrument4Sound(group.bit, group.length);
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
					playSample(audioSamples[2]['kick']);
				} else {
					playSample(audioSamples[2]['rim']);
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
				playSample(audioSamples[1]['hat']);
			} else {
				playSample(audioSamples[1]['kick']);
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

function getAudioUrl(path) {
	return new URL(path, import.meta.url).href;
}

async function preloadAudioFiles() {
	audioArrayBuffers[1]['kick'] = await fetchAudioFile(getAudioUrl('./assets/audio/01/kick.wav'));
	audioArrayBuffers[1]['hat'] = await fetchAudioFile(getAudioUrl('./assets/audio/01/hat.wav'));

	audioArrayBuffers[2]['kick'] = await fetchAudioFile(getAudioUrl('./assets/audio/02/kick.wav'));
	audioArrayBuffers[2]['rim'] = await fetchAudioFile(getAudioUrl('./assets/audio/02/rim.wav'));

	audioArrayBuffers[3]['1.wav'] = await fetchAudioFile(getAudioUrl('./assets/audio/03/01.wav'));
	audioArrayBuffers[3]['2.wav'] = await fetchAudioFile(getAudioUrl('./assets/audio/03/02.wav'));
	audioArrayBuffers[3]['3.wav'] = await fetchAudioFile(getAudioUrl('./assets/audio/03/03.wav'));
	audioArrayBuffers[3]['4.wav'] = await fetchAudioFile(getAudioUrl('./assets/audio/03/04.wav'));
	audioArrayBuffers[3]['5.wav'] = await fetchAudioFile(getAudioUrl('./assets/audio/03/05.wav'));
	audioArrayBuffers[3]['6.wav'] = await fetchAudioFile(getAudioUrl('./assets/audio/03/06.wav'));
	audioArrayBuffers[3]['7.wav'] = await fetchAudioFile(getAudioUrl('./assets/audio/03/07.wav'));
	audioArrayBuffers[3]['8.wav'] = await fetchAudioFile(getAudioUrl('./assets/audio/03/08.wav'));

	audioArrayBuffers[4]['1.wav'] = await fetchAudioFile(getAudioUrl('./assets/audio/04/01.wav'));
	audioArrayBuffers[4]['2.wav'] = await fetchAudioFile(getAudioUrl('./assets/audio/04/02.wav'));
	audioArrayBuffers[4]['3.wav'] = await fetchAudioFile(getAudioUrl('./assets/audio/04/03.wav'));
	audioArrayBuffers[4]['4.wav'] = await fetchAudioFile(getAudioUrl('./assets/audio/04/04.wav'));
	audioArrayBuffers[4]['5.wav'] = await fetchAudioFile(getAudioUrl('./assets/audio/04/05.wav'));
	audioArrayBuffers[4]['6.wav'] = await fetchAudioFile(getAudioUrl('./assets/audio/04/06.wav'));
	audioArrayBuffers[4]['7.wav'] = await fetchAudioFile(getAudioUrl('./assets/audio/04/07.wav'));
	audioArrayBuffers[4]['8.wav'] = await fetchAudioFile(getAudioUrl('./assets/audio/04/08.wav'));
}

async function decodeAllSamples() {
	audioSamples[1]['kick'] = await decodeAudioData(audioArrayBuffers[1]['kick']);
	audioSamples[1]['hat'] = await decodeAudioData(audioArrayBuffers[1]['hat']);

	audioSamples[2]['kick'] = await decodeAudioData(audioArrayBuffers[2]['kick']);
	audioSamples[2]['rim'] = await decodeAudioData(audioArrayBuffers[2]['rim']);

	audioSamples[3]['1.wav'] = await decodeAudioData(audioArrayBuffers[3]['1.wav']);
	audioSamples[3]['2.wav'] = await decodeAudioData(audioArrayBuffers[3]['2.wav']);
	audioSamples[3]['3.wav'] = await decodeAudioData(audioArrayBuffers[3]['3.wav']);
	audioSamples[3]['4.wav'] = await decodeAudioData(audioArrayBuffers[3]['4.wav']);
	audioSamples[3]['5.wav'] = await decodeAudioData(audioArrayBuffers[3]['5.wav']);
	audioSamples[3]['6.wav'] = await decodeAudioData(audioArrayBuffers[3]['6.wav']);
	audioSamples[3]['7.wav'] = await decodeAudioData(audioArrayBuffers[3]['7.wav']);
	audioSamples[3]['8.wav'] = await decodeAudioData(audioArrayBuffers[3]['8.wav']);

	audioSamples[4]['1.wav'] = await decodeAudioData(audioArrayBuffers[4]['1.wav']);
	audioSamples[4]['2.wav'] = await decodeAudioData(audioArrayBuffers[4]['2.wav']);
	audioSamples[4]['3.wav'] = await decodeAudioData(audioArrayBuffers[4]['3.wav']);
	audioSamples[4]['4.wav'] = await decodeAudioData(audioArrayBuffers[4]['4.wav']);
	audioSamples[4]['5.wav'] = await decodeAudioData(audioArrayBuffers[4]['5.wav']);
	audioSamples[4]['6.wav'] = await decodeAudioData(audioArrayBuffers[4]['6.wav']);
	audioSamples[4]['7.wav'] = await decodeAudioData(audioArrayBuffers[4]['7.wav']);
	audioSamples[4]['8.wav'] = await decodeAudioData(audioArrayBuffers[4]['8.wav']);
}

preloadAudioFiles();

startBtn.addEventListener('click', async () => {
	if (!audioContext) {
		audioContext = new (window.AudioContext || window.webkitAudioContext)();
		await decodeAllSamples();

		const initialNumber = parseInt(numberSlider.value);
		updateSequence(initialNumber);
	}

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
