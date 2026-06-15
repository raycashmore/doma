<script lang="ts">
  import { page } from '$app/state';
  import ListsScreen from '$lib/ListsScreen.svelte';
</script>

<ListsScreen selectedPublicId={page.params.publicId} selectedSlug={page.params.slug ?? null} />
