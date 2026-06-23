<script lang="ts">
  let {
    message = 'Opening Lists...',
    detail = 'Checking your session and warming up your lists.'
  }: {
    message?: string;
    detail?: string;
  } = $props();
</script>

<section class="startup-placeholder" role="status" aria-live="polite" aria-busy="true">
  <span class="sr-only">{message} {detail}</span>

  <div class="startup-skeleton-grid" aria-hidden="true">
    <aside class="startup-skeleton-panel startup-skeleton-picker">
      <div class="startup-skeleton-row startup-skeleton-row--heading"></div>
      <div class="startup-skeleton-pill"></div>
      <div class="startup-skeleton-stack">
        <div class="startup-skeleton-card startup-skeleton-card--active"></div>
        <div class="startup-skeleton-card"></div>
        <div class="startup-skeleton-card"></div>
      </div>
    </aside>

    <section class="startup-skeleton-panel startup-skeleton-main">
      <div class="startup-skeleton-row startup-skeleton-row--title"></div>
      <div class="startup-skeleton-input"></div>
      <div class="startup-skeleton-stack">
        <div class="startup-skeleton-item"></div>
        <div class="startup-skeleton-item"></div>
        <div class="startup-skeleton-item startup-skeleton-item--short"></div>
      </div>
    </section>

    <aside class="startup-skeleton-panel startup-skeleton-detail">
      <div class="startup-skeleton-row startup-skeleton-row--title"></div>
      <div class="startup-skeleton-detail-box"></div>
      <div class="startup-skeleton-row"></div>
      <div class="startup-skeleton-row startup-skeleton-row--short"></div>
    </aside>
  </div>
</section>
