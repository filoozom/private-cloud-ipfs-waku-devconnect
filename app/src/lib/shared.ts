export const toHex = (array: Uint8Array) => {
	return Array.from(array)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
};
export const fromHex = (hex: string): Uint8Array =>
	// @ts-expect-error TODO: Error handling for matching
	Uint8Array.from(hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));

export const hashTopic = async (text: string) => {
	const input = new TextEncoder().encode(text);
	const hash = await crypto.subtle.digest('SHA-256', input);
	return toHex(new Uint8Array(hash)).substring(0, 16);
};
