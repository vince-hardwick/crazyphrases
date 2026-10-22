import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSupportedNode } from '../.github/scripts/check-node.mjs';

test('local commands accept corrected releases in the qualified Node majors', () => {
  for (const version of ['22.23.4', '22.24.0', '24.22.1', '24.23.0']) {
    assert.doesNotThrow(() => assertSupportedNode(version));
  }
});

test('commands reject affected releases and unqualified majors', () => {
  for (const version of ['22.19.0', '22.23.3', '24.21.0', '24.22.0', '26.12.1', '24.22.1-rc.1', 'invalid']) {
    assert.throws(() => assertSupportedNode(version), /Node/);
  }
});

test('CI requires corrected Node 24 rather than the local Node 22 option', () => {
  assert.throws(() => assertSupportedNode('22.23.4', true), /Node/);
  assert.throws(() => assertSupportedNode('24.22.0', true), /Node/);
  assert.doesNotThrow(() => assertSupportedNode('24.22.1', true));
});
