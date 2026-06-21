<script lang="ts">
  import { page } from '$app/state';
  import ListsScreen from '$lib/lists/components/ListsScreen.svelte';
</script>

<ListsScreen selectedPublicId={page.params.publicId} />
