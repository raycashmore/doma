import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

import { repositoryRoot } from './cli.ts';
import { readJson } from './files.ts';
import { managedVariables, pencilApplyScript } from './pencil.ts';

const desired = managedVariables(readJson(`${repositoryRoot}/packages/tokens/generated/pencil/variables.json`));
function apply(variables: Record<string, unknown>, previous = {}, version = '1.2.20') {
  const nodes = [{ id: 'existing', type: 'text', fill: '$annotation' }];
  const original = structuredClone(nodes);
  runInNewContext(pencilApplyScript(desired, previous, version), {
    GetVariables: () => ({ variables }),
    SetVariables: (patch: Record<string, unknown>) => Object.assign(variables, patch),
    Get: () => nodes,
    Print: () => undefined
  });
  assert.deepEqual(nodes, original);
  return variables;
}
test('Pencil adapter creates only listed variables and preserves unrelated data', () => {
  const unrelated = { type: 'color', value: '#123456' };
  const result = apply({ annotation: unrelated });
  assert.equal(result.annotation, unrelated);
  assert.deepEqual(Object.keys(result).sort(), ['annotation', ...Object.keys(desired)].sort());
  assert.equal(
    JSON.stringify(result['doma-web-color-content-primary']),
    JSON.stringify(desired['doma-web-color-content-primary'])
  );
});
test('Pencil adapter updates only from an explicit prior managed state', () => {
  const result = apply(structuredClone(desired), desired);
  assert.equal(JSON.stringify(result), JSON.stringify(desired));
  assert.throws(() => apply(structuredClone(desired)), /collision/);
  assert.throws(
    () => apply({ ...desired, 'doma-web-color-content-primary': { type: 'number', value: 3 } }, desired),
    /collision/
  );
  assert.throws(() => apply({ 'doma-surprise': { type: 'number', value: 1 } }), /Unexpected managed name/);
});
test('Pencil adapter refuses unsupported versions, targets and types', () => {
  assert.throws(() => apply({}, {}, 'future'), /Unsupported Pen API version/);
  assert.throws(() => managedVariables({ schemaVersion: 2 }), /Unsupported Pencil manifest/);
  assert.throws(() => managedVariables({ schemaVersion: 1, target: 'design/old.pen' }), /Unsupported Pencil manifest/);
  assert.throws(
    () =>
      managedVariables({
        schemaVersion: 1,
        target: 'design/design-system.pen',
        variables: { 'doma-web-color-content-primary': { type: 'color', value: 'bad' } }
      }),
    /Unsupported Pencil value/
  );
});
