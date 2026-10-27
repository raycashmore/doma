import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { PatternRecord } from './catalog.ts';
import { localFile } from './files.ts';
import { loadTokens } from './tokens.ts';

const cell = (text: string) => text.replaceAll('|', '\\|').replaceAll('\n', ' ');
function table(headers: string[], rows: string[][]): string {
  return `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n${rows.map((row) => `| ${row.map(cell).join(' | ')} |`).join('\n')}\n`;
}
export function guidePages(root: string, records: PatternRecord[], revision: string): Record<string, string> {
  const draft = revision.endsWith('-dirty');
  const sourceLink = (ref: string) =>
    draft
      ? `\`${ref}\` (local draft path)`
      : `[${path.basename(ref)}](https://github.com/raycashmore/doma/blob/${revision}/${ref})`;
  const stamp = `Build revision: \`${revision}\`${draft ? ' — local draft; source paths refer to this checkout.' : ''}\n\n`;
  const pages: Record<string, string> = {};
  for (const name of ['index', 'contributing'])
    pages[`${name}.md`] = stamp + readFileSync(localFile(root, `packages/design-system/guidance/${name}.md`), 'utf8');
  pages['patterns/index.md'] =
    `${stamp}# Patterns\n\nSearch for a task, state or platform. Proposed patterns expose current guidance and gaps; they are not promoted shared contracts.\n\n${records.map(({ contract: c }) => `- [${c.title}](/patterns/${c.id}.html) — ${c.summary} **${c.status} · ${c.version}**`).join('\n')}\n`;
  const { profile } = loadTokens(root);
  pages['foundations.md'] =
    `${stamp}# Foundations\n\nThese are two candidate roles, with explicit native variants. Token generation and adoption are pending RAY-228. Handwritten CSS exports remain unchanged.\n\n${table(
      ['Role', 'Type', 'Meaning', 'Web Pencil name', 'Android Pencil name'],
      profile.roles.map((r) => [r.id, r.type, r.meaning, r.pencilNames.web, r.pencilNames.android])
    )}\n${table(
      ['Platform', 'Selected sources', 'Why the values differ', 'Conversion policy'],
      (['web', 'android'] as const).map((p) => [
        p,
        profile.platforms[p].sources.join(', '),
        profile.platforms[p].reason,
        profile.conversions[p]
      ])
    )}\nProfile: ${sourceLink('packages/tokens/profile.json')}. ${profile.aliasPolicy}\n\nThe bounded profile uses ${profile.format}: ${profile.allowedTypes.join(', ')}. This slice checks role references and this limited source shape. Full vendored-schema validation, output generation, alias/output collision checks and propagation proof arrive in RAY-228. No new CSS or Kotlin output is adopted yet.\n`;
  for (const { contract: c, guide } of records) {
    pages[`patterns/${c.id}.md`] =
      `${stamp}Contract: **${c.status} · ${c.version}** · schema ${c.schemaVersion}\n\n${guide}\n## Roles\n\n${table(
        ['ID', 'Meaning'],
        c.roles.map((r) => [r.id, r.meaning])
      )}\n## States\n\n${table(
        ['ID', 'Meaning'],
        c.states.map((s) => [s.id, s.meaning])
      )}\n## Rules\n\nRules bind adoption after maintainer approval. Must and should are requirement levels; they are not evidence of current compliance.\n\n${table(
        ['ID', 'Level', 'Behaviour', 'Applies to'],
        c.rules.map((r) => [r.id, r.level, r.behaviour, r.platforms.join(', ')])
      )}\n## Token roles\n\n${table(
        ['ID', 'Variants'],
        c.tokenRoles.map((r) => [r.id, r.platforms.join(', ')])
      )}\n## Platform mappings and native references\n\n${c.implementations.map((i) => `### ${i.platform} — ${i.framework}\n\nSupported states: ${i.stateIds.map((s) => `\`${s}\``).join(', ')}.\n\nReferenced rules: ${i.ruleIds.map((r) => `\`${r}\``).join(', ')}. These references do not certify coverage.\n\nExclusions:\n\n${i.exclusions.map((s) => `- ${s}`).join('\n')}\n\nKnown gaps:\n\n${i.gaps.map((s) => `- ${s}`).join('\n')}\n\nSource:\n\n${i.sourcePaths.map((p) => `- ${sourceLink(p)}`).join('\n')}\n\nTests (navigation, not results):\n\n${i.testPaths.map((p) => `- ${sourceLink(p)}`).join('\n')}`).join('\n\n')}\n\n## Design references\n\n${c.designReferences.length ? c.designReferences.map((r) => `- ${sourceLink(r.path)}; nodes ${r.nodeIds.join(', ')}; ${r.illustrative ? 'illustration only' : 'reviewed representation'}; exports ${r.assetPaths.map(sourceLink).join(', ')}`).join('\n') : 'Pending RAY-229: no dedicated Pencil nodes or exported visuals are linked yet.'}\n\nContract source: ${sourceLink(`packages/design-system/patterns/${c.id}/contract.json`)}.\n`;
  }
  return pages;
}
