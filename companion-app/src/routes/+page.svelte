<script lang="ts">
	import QrCode from '$lib/components/qr-code.svelte';
	import { onMount } from 'svelte';

	let publicKey = '';

	onMount(async () => {
		const result = await fetch('http://localhost:8080/pairing');
		const data = await result.json();
		publicKey = data.publicKey;
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
