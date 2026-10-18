import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findDuplicate, defaultName } from '../app/js/sites-logic.js';

const sites = [
    { id: 'a', owner: 'exhibita', repo: 'gtg-test-site', branch: 'main', name: 'Test site' },
    { id: 'b', owner: 'exhibita', repo: 'vg-site', branch: 'live', name: 'VG' }
];

test('findDuplicate finds the same owner, repository and branch', () => {
    assert.equal(findDuplicate(sites, { owner: 'exhibita', repo: 'gtg-test-site', branch: 'main' })?.id, 'a');
});

test('findDuplicate ignores case in owner and repository names (GitHub does too)', () => {
    assert.equal(findDuplicate(sites, { owner: 'Exhibita', repo: 'GTG-Test-Site', branch: 'main' })?.id, 'a');
});

test('the same repository on another branch is not a duplicate', () => {
    assert.equal(findDuplicate(sites, { owner: 'exhibita', repo: 'gtg-test-site', branch: 'preview' }), undefined);
});

test('defaultName uses the repository name', () => {
    assert.equal(defaultName({ owner: 'exhibita', repo: 'gtg-test-site' }), 'gtg-test-site');
    assert.equal(defaultName(null), '');
});
