import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionCache } from '../assets/js/cache.js';

test('cache accepts zero, rejects expired/invalid values and tolerates unavailable storage', () => {
    const values = new Map();
    globalThis.sessionStorage = {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key)
    };
    sessionCache.set('zero', 0);
    assert.equal(sessionCache.get('zero', 10000), 0);
    values.set('expired', JSON.stringify({ timestamp: Date.now() - 20000, value: 7 }));
    values.set('invalid', '{invalid');
    assert.equal(sessionCache.get('expired', 100), null);
    assert.equal(sessionCache.get('invalid', 100), null);
    Object.defineProperty(globalThis, 'sessionStorage', {
        configurable: true, get() { throw new Error('Access denied'); }
    });
    assert.equal(sessionCache.get('zero', 10000), null);
    assert.doesNotThrow(() => sessionCache.set('zero', 0));
    delete globalThis.sessionStorage;
});
