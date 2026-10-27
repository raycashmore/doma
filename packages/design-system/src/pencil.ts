import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { managedVariables, supportedPenVersion } from '@repo/tokens/pencil';

import { localFile, object, readJson, unique } from './files.ts';
import type { Pattern } from './schema.ts';

// Pen documents are opaque. Bind the supported API capture to the exact saved
// file and inspected exports, rather than pretending to parse encrypted nodes.
export function validatePencilReferences(root: string, references: Pattern['designReferences']): void {
  const proof = object(readJson(localFile(root, 'design/design-system.proof.json')));
  if (proof.schemaVersion !== 1 || proof.appVersion !== supportedPenVersion)
    throw new Error('Unsupported Pencil evidence version');
  const digest = (relative: string) =>
    createHash('sha256')
      .update(readFileSync(localFile(root, relative)))
      .digest('hex');
  if (digest('design/design-system.pen') !== proof.documentSha256) throw new Error('Stale Pencil document capture');
  const expected = managedVariables(readJson(localFile(root, 'packages/tokens/generated/pencil/variables.json')));
  const actual = object(proof.variables);
  for (const name of Object.keys(actual).filter((name) => name.startsWith('doma-')))
    if (!(name in expected)) throw new Error(`Unexpected managed Pencil variable ${name}`);
  for (const [name, value] of Object.entries(expected)) {
    const observed = object(actual[name]);
    if (observed.type !== value.type || observed.value !== value.value)
      throw new Error(`Stale Pencil variable ${name}`);
  }
  if (!Array.isArray(proof.nodes) || !Array.isArray(proof.assets)) throw new Error('Invalid Pencil API capture');
  const nodes = proof.nodes.map(object);
  const ids = nodes.map((node) => {
    if (typeof node.id !== 'string' || !node.id || typeof node.name !== 'string' || typeof node.type !== 'string')
      throw new Error('Invalid Pencil node');
    return node.id;
  });
  unique(ids, 'Pencil nodes');
  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const node of nodes) {
    const seen = new Set<unknown>([node.id]);
    let parent = node.parent;
    while (parent !== null) {
      if (seen.has(parent)) throw new Error('Cyclic Pencil topology');
      seen.add(parent);
      const ancestor = byId.get(parent);
      if (!ancestor) throw new Error('Missing Pencil parent');
      parent = ancestor.parent;
    }
  }
  const serialized = JSON.stringify(nodes);
  for (const name of Object.keys(expected))
    if (!serialized.includes(`"$${name}"`)) throw new Error(`Unbound Pencil variable ${name}`);
  const assets = proof.assets.map(object);
  unique(
    assets.map((asset) => String(asset.path)),
    'Pencil assets'
  );
  for (const ref of references) {
    if (ref.path !== 'design/design-system.pen')
      throw new Error('Design references must target the dedicated design-system.pen');
    for (const id of ref.nodeIds) if (!byId.has(id)) throw new Error(`Missing Pencil node ${id}`);
    for (const assetPath of ref.assetPaths) {
      const asset = assets.find((candidate) => candidate.path === assetPath);
      if (!asset || !ref.nodeIds.includes(String(asset.nodeId))) throw new Error(`Unmapped Pencil asset ${assetPath}`);
      const node = byId.get(asset.nodeId);
      if (node?.type !== 'frame' || node.parent !== null) throw new Error('Pencil export must reference a root frame');
      const bytes = readFileSync(localFile(root, assetPath));
      if (digest(assetPath) !== asset.sha256) throw new Error(`Stale Pencil export ${assetPath}`);
      if (
        bytes.length < 33 ||
        bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
        bytes.toString('ascii', 12, 16) !== 'IHDR' ||
        bytes.readUInt32BE(16) !== asset.width ||
        bytes.readUInt32BE(20) !== asset.height ||
        !(Number(asset.width) > 0) ||
        !(Number(asset.height) > 0)
      )
        throw new Error(`Invalid Pencil PNG ${assetPath}`);
    }
  }
}
