<script lang="ts">
	import QrCode from '$lib/components/qr-code.svelte';
	import { onMount } from 'svelte';

	const toHex = (array: Uint8Array) => {
		return Array.from(array)
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');
	};

	const formatPublicKey = (key: string) => {
		return key.substring(0, 4) + '..' + key.substring(key.length - 4, key.length);
	};

	type Registered = {
		localPublicKey: string;
		remotePublicKey: string;
		metadata: {
			name: string;
		};
	};

	let publicKey = '';
	let registered: Registered[] = [];

	onMount(async () => {
		const result = await fetch('http://localhost:8080/pairing');
		const data = await result.json();
		publicKey = data.publicKey;
	});

	onMount(async () => {
		while (true) {
			try {
				const result = await fetch('http://localhost:8080/registered');
				registered = await result.json();
			} finally {
				await new Promise((resolve) => setTimeout(resolve, 5000));
			}
		}
	});
</script>

{#if publicKey}
	<div style:width="480px" style:height="480px" style:margin="auto" style:margin-top="32px">
		<QrCode value={publicKey} />
	</div>
	<div style:text-align="center">
		{publicKey}
	</div>
{/if}

<ul>
	{#each registered as peer}
		<li>
			{peer.metadata.name}: local {formatPublicKey(peer.localPublicKey)}, remote {formatPublicKey(
				peer.remotePublicKey
			)} (<a href="#">Revoke</a>)
		</li>
	{/each}
</ul>
