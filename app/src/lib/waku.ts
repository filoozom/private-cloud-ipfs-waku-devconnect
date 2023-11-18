import type { IFilterSubscription } from '@waku/sdk';
import { getNode } from './node.js';
import { hashTopic, toHex } from './shared.js';
import {
	createEncoder,
	createDecoder,
	getPublicKey,
	type DecodedMessage
} from '@waku/message-encryption/ecies';
import { equals } from 'uint8arrays/equals';

let subscription: IFilterSubscription | undefined;
export const callbacks: ((json: Record<string, unknown>) => void)[] = [];

const getSubscription = async () => {
	if (subscription) {
		return subscription;
	}

	const node = await getNode();
	return (subscription = await node.filter.createSubscription());
};

const getTopic = async (publicKey: Uint8Array) => {
	const hash = await hashTopic(toHex(publicKey));
	return `/cloud-companion/1/${hash}/json`;
};

const decodePayload = (message: DecodedMessage) => {
	const string = new TextDecoder().decode(message.payload);
	return JSON.parse(string);
};

const encodePayload = (json: unknown) => {
	const data = JSON.stringify(json);
	return new TextEncoder().encode(data);
};

const getEncoder = async (remoteKey: Uint8Array, privateKey: Uint8Array) => {
	const topic = await getTopic(remoteKey);
	return createEncoder({
		contentTopic: topic,
		ephemeral: true,
		publicKey: remoteKey,
		sigPrivKey: privateKey
	});
};

export const doPairing = async (remoteKey: Uint8Array, privateKey: Uint8Array, name: string) => {
	const topic = await getTopic(remoteKey);
	console.log(
		`Pairing with ${toHex(remoteKey)} on ${topic} with public key ${toHex(
			getPublicKey(privateKey)
		)}`
	);

	const node = await getNode();
	const encoder = await getEncoder(remoteKey, privateKey);
	const payload = encodePayload({ name });

	await subscribeToKey(remoteKey, privateKey);
	await node.lightPush.send(encoder, { payload });
};

export const uploadFile = async (remoteKey: Uint8Array, privateKey: Uint8Array, file: Blob) => {
	const node = await getNode();
	const encoder = await getEncoder(remoteKey, privateKey);
	const payload = encodePayload({
		action: 'pin',
		data: toHex(new Uint8Array(await file.arrayBuffer()))
	});

	await node.lightPush.send(encoder, { payload });
};

const callback = async (remoteKey: Uint8Array, message: DecodedMessage) => {
	if (!message.payload) {
		console.debug('no payload');
		return;
	}

	if (!equals(message.signaturePublicKey ?? new Uint8Array(), remoteKey)) {
		console.debug('wrong signer, got', message.signaturePublicKey, 'expected', remoteKey);
		return;
	}

	const json = decodePayload(message);
	console.log(json);

	for (const cb of callbacks) {
		cb(json);
	}
};

export const subscribeToKey = async (remoteKey: Uint8Array, privateKey: Uint8Array) => {
	const decoder = createDecoder(await getTopic(remoteKey), privateKey);
	const subscription = await getSubscription();

	console.log(`Listening to ${await getTopic(remoteKey)}`);
	await subscription.subscribe([decoder], callback.bind(null, remoteKey));
};

export const unsubscribeFromKey = async (remoteKey: Uint8Array) => {
	console.log(`Unsubscribing from ${await getTopic(remoteKey)}`);
	const subscription = await getSubscription();
	subscription.unsubscribe([await getTopic(remoteKey)]);
};
