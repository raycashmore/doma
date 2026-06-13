<script lang="ts">
  import { activeItems, completedItems, lists, selectedItemProperties } from '$lib/fixtures';

  const selectedList = lists[0];
  const selectedItem = activeItems[0];
</script>

<section class="lists-screen" aria-label="Lists">
  <aside class="list-picker" aria-label="Lists">
    <div class="panel-heading">
      <p>My Lists</p>
      <button type="button" aria-label="Create list">+</button>
    </div>

    <div class="search-shell" aria-label="Search lists">Search lists</div>

    <div class="list-stack">
      {#each lists as list (list.id)}
        <button type="button" class:active={list.id === selectedList.id}>
          <span>
            <strong>{list.name}</strong>
            <small>{list.visibility}</small>
          </span>
          <em>{list.activeCount}</em>
        </button>
      {/each}
    </div>
  </aside>

  <section class="item-pane" aria-labelledby="active-list-title">
    <header>
      <div>
        <p>Shared list</p>
        <h1 id="active-list-title">{selectedList.name}</h1>
      </div>
      <button type="button">Add item</button>
    </header>

    <div class="quick-entry">Add a list item</div>

    <div class="item-section">
      <p class="section-label">Active</p>
      {#each activeItems as item (item.id)}
        <button type="button" class="list-item" class:selected={item.id === selectedItem.id}>
          <span aria-hidden="true" class="check-ring"></span>
          <span>
            <strong>{item.title}</strong>
            <small>{item.meta}</small>
          </span>
        </button>
      {/each}
    </div>

    <div class="item-section completed">
      <p class="section-label">Completed</p>
      {#each completedItems as item (item.id)}
        <button type="button" class="list-item">
          <span aria-hidden="true" class="check-ring done"></span>
          <span>
            <strong>{item.title}</strong>
            <small>{item.meta}</small>
          </span>
        </button>
      {/each}
    </div>
  </section>

  <aside class="detail-panel" aria-label="Item details">
    <p class="section-label">Item details</p>
    <h2>{selectedItem.title}</h2>
    <label>
      <span>Title</span>
      <input value={selectedItem.title} aria-label="Item title" readonly />
    </label>

    <div class="property-list">
      {#each selectedItemProperties as property (property.label)}
        <div class="property-row">
          <span>{property.label}</span>
          <strong>{property.value}</strong>
        </div>
      {/each}
    </div>
  </aside>
</section>
