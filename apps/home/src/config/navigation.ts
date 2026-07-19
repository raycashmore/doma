import type { InjectionKey } from 'vue';

export const homeUrlBuilderKey = Symbol('homeUrlBuilder') as InjectionKey<(url: string) => string>;
