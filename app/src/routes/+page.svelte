<script lang="ts">
	import { onMount } from 'svelte';
	import type { LightNode } from '@waku/sdk';
	import { getNode } from '../lib/node';
	import { generatePrivateKey, getPublicKey } from '@waku/message-encryption/ecies';
	import { callbacks, doPairing, subscribeToKey, uploadFile } from '$lib/waku';
	import { fromHex, toHex } from '$lib/shared';
	import { browser } from '$app/environment';

	const formatPublicKey = (publicKey: Uint8Array) => {
		const key = toHex(publicKey);
		return key.substring(0, 4) + '..' + key.substring(key.length - 4, key.length);
	};

	const loadKey = (name: string) => {
		if (!browser) {
			return;
		}

		const stringKey = localStorage.getItem(name);
		if (stringKey) {
			return fromHex(stringKey);
		}
	};

	const loadPrivateKey = () => {
		if (!browser) {
			return;
		}

		const loaded = loadKey('privateKey');
		if (loaded) {
			return loaded;
		}

		const key = generatePrivateKey();
		localStorage.setItem('privateKey', toHex(key));
		return key;
	};

	let registered = (browser && localStorage.getItem('registered') === 'true') ?? false;
	let cid = '';

	// TODO: This is disgusting
	callbacks.push((data: any) => {
		if (data.action === 'registration-success') {
			registered = true;
			localStorage.setItem('remoteKey', remoteKey);
			localStorage.setItem('registered', 'true');
		} else if (data.action === 'upload-success') {
			cid = data.cid;
		}
	});

	const loadedRemoteKey = loadKey('remoteKey');
	let node: LightNode | undefined;
	let remoteKey = loadedRemoteKey ? toHex(loadedRemoteKey) : '';
	let privateKey = loadPrivateKey();
	let files: any;

	onMount(async () => {
		node = await getNode();

		if (privateKey && remoteKey && registered) {
			subscribeToKey(fromHex(remoteKey), privateKey);
		}
	});

	const pair = async () => {
		if (!privateKey) {
			return;
		}

		await doPairing(fromHex(remoteKey), privateKey);
		localStorage.setItem('registered', 'true');
	};

	const upload = async () => {
		if (!privateKey) {
			return;
		}

		cid = '';
		uploadFile(fromHex(remoteKey), privateKey, files[0]);
	};
</script>

{#if privateKey}
	<div style:text-align="center">
		Connected as {formatPublicKey(getPublicKey(privateKey))}
		{#if remoteKey}
			to {formatPublicKey(fromHex(remoteKey))}
		{/if}
	</div>
{/if}

{#if !node}
	<p>Loading...</p>
{:else if !remoteKey || !registered}
	<div style:margin-top="32px" style:text-align="center">
		<p>Connected</p>

		<form on:submit|preventDefault={pair}>
			<input type="text" bind:value={remoteKey} />
			<button type="submit">Pair</button>
		</form>
	</div>
{:else}
	<div style:margin-top="32px" style:text-align="center">
		Upload a file

		<form on:submit|preventDefault={upload} style:margin-top="16px">
			<input type="file" accept="image/png, image/jpeg" bind:files />
			<button type="submit">Upload</button>
		</form>

		{#if cid}
			<p style:margin-top="8px">
				CID: {cid}
			</p>
		{/if}
	</div>
{/if}
