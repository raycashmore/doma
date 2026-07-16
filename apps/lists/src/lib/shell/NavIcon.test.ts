import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import NavIcon from './NavIcon.svelte';

const mounted: Array<ReturnType<typeof mount>> = [];

afterEach(async () => {
  await Promise.all(mounted.splice(0).map((component) => unmount(component)));
  document.body.innerHTML = '';
});

describe('NavIcon', () => {
  it('renders a visible icon for the Meals navigation item', () => {
    const target = document.createElement('div');
    document.body.append(target);
    mounted.push(mount(NavIcon, { target, props: { name: 'meals' } }));

    expect(target.querySelectorAll('path').length).toBeGreaterThan(0);
  });
});
