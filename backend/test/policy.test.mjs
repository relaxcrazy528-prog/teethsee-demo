import test from 'node:test';
import assert from 'node:assert/strict';

import { ApiError } from '../src/errors.mjs';
import { permissionAllows, requireProfileAccess } from '../src/policy.mjs';

function fakeDb(accessLevel) {
  return {
    prepare() {
      return {
        bind() {
          return {
            async first() {
              return accessLevel === null ? null : { access_level: accessLevel };
            }
          };
        }
      };
    }
  };
}

test('permission ordering is explicit', () => {
  assert.equal(permissionAllows('owner', 'edit'), true);
  assert.equal(permissionAllows('edit', 'consult'), true);
  assert.equal(permissionAllows('consult', 'edit'), false);
  assert.equal(permissionAllows('view', 'consult'), false);
  assert.equal(permissionAllows('none', 'view'), false);
});

test('user B receives non-disclosing not-found for user A profile', async () => {
  await assert.rejects(() => requireProfileAccess(fakeDb('none'), 'user-b', 'profile-a', 'view'), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 404);
    assert.equal(error.code, 'profile_not_found');
    return true;
  });
});

test('expired or missing profile remains non-disclosing', async () => {
  await assert.rejects(() => requireProfileAccess(fakeDb(null), 'user-b', 'missing-profile', 'view'), (error) => {
    assert.equal(error.status, 404);
    return true;
  });
});
