const cache = new Map();

/**
 * Computes the Collatz sequence for a given number and returns
 * a bit-packed representation where each bit indicates if that step was even (0) or odd (1).
 *
 * @param {number} n - The starting number
 * @returns {{ sequence: Uint8Array, length: number }} - The bit-packed sequence and its length
 */
export function collatzSequence(n) {
	if (cache.has(n)) {
		return cache.get(n);
	}

	const bits = [];
	let current = n;

	while (current !== 1) {
		if (current % 2 === 0) {
			current = current / 2;
			bits.push(0);
		} else {
			current = 3 * current + 1;
			bits.push(1);
		}
	}

	bits.push(1);

	const length = bits.length;

	const byteCount = Math.ceil(length / 8);
	const sequence = new Uint8Array(byteCount);

	for (let i = 0; i < length; i++) {
		const byteIndex = Math.floor(i / 8);
		const bitIndex = i % 8;
		if (bits[i] === 1) {
			sequence[byteIndex] |= 1 << (7 - bitIndex);
		}
	}

	const result = { sequence, length };
	cache.set(n, result);
	return result;
}

/**
 * Unpacks the bit-packed sequence into an array of 0s (even) and 1s (odd)
 * @param {{ sequence: Uint8Array, length: number }} packed - The packed sequence
 * @returns {number[]} Array of 0s and 1s
 */
export function unpackSequence(packed) {
	const { sequence, length } = packed;
	const bits = [];
	
	for (let i = 0; i < length; i++) {
		const byteIndex = Math.floor(i / 8);
		const bitIndex = i % 8;
		const bit = (sequence[byteIndex] >> (7 - bitIndex)) & 1;
		bits.push(bit);
	}
	
	return bits;
}
