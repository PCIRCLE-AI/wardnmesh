/**
 * LRU Cache Tests
 *
 * Comprehensive test suite for LRUCache utility.
 *
 * Coverage:
 * - Basic operations (get, set, delete, has, clear)
 * - LRU eviction behavior
 * - TTL expiration
 * - Access order tracking
 * - Statistics tracking
 * - Edge cases
 */

import { LRUCache } from '../../src/utils/lru-cache';

describe('LRUCache', () => {
  describe('Basic Operations', () => {
    it('should set and get values', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 });

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBe(2);
      expect(cache.get('c')).toBe(3);
    });

    it('should return undefined for non-existent keys', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 });

      expect(cache.get('missing')).toBeUndefined();
    });

    it('should update existing values', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 });

      cache.set('a', 1);
      cache.set('a', 2);

      expect(cache.get('a')).toBe(2);
      expect(cache.size).toBe(1);
    });

    it('should check key existence with has()', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 });

      cache.set('a', 1);

      expect(cache.has('a')).toBe(true);
      expect(cache.has('missing')).toBe(false);
    });

    it('should delete entries', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 });

      cache.set('a', 1);
      cache.set('b', 2);

      expect(cache.delete('a')).toBe(true);
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBe(2);
      expect(cache.size).toBe(1);
    });

    it('should return false when deleting non-existent key', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 });

      expect(cache.delete('missing')).toBe(false);
    });

    it('should clear all entries', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 });

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      cache.clear();

      expect(cache.size).toBe(0);
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBeUndefined();
      expect(cache.get('c')).toBeUndefined();
    });

    it('should track cache size', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 });

      expect(cache.size).toBe(0);

      cache.set('a', 1);
      expect(cache.size).toBe(1);

      cache.set('b', 2);
      expect(cache.size).toBe(2);

      cache.delete('a');
      expect(cache.size).toBe(1);

      cache.clear();
      expect(cache.size).toBe(0);
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used entry when full', () => {
      const cache = new LRUCache<string, number>({ maxSize: 3 });

      // Fill cache
      cache.set('a', 1); // LRU: a
      cache.set('b', 2); // LRU: a, b
      cache.set('c', 3); // LRU: a, b, c

      // Add 4th item - should evict 'a' (least recently used)
      cache.set('d', 4); // LRU: b, c, d

      expect(cache.get('a')).toBeUndefined(); // Evicted
      expect(cache.get('b')).toBe(2);
      expect(cache.get('c')).toBe(3);
      expect(cache.get('d')).toBe(4);
      expect(cache.size).toBe(3);
    });

    it('should update LRU order on get()', () => {
      const cache = new LRUCache<string, number>({ maxSize: 3 });

      cache.set('a', 1); // LRU: a
      cache.set('b', 2); // LRU: a, b
      cache.set('c', 3); // LRU: a, b, c

      // Access 'a' - should move to head
      cache.get('a'); // LRU: b, c, a

      // Add 4th item - should evict 'b' (now least recently used)
      cache.set('d', 4); // LRU: c, a, d

      expect(cache.get('a')).toBe(1); // Still exists
      expect(cache.get('b')).toBeUndefined(); // Evicted
      expect(cache.get('c')).toBe(3);
      expect(cache.get('d')).toBe(4);
    });

    it('should update LRU order on set() for existing keys', () => {
      const cache = new LRUCache<string, number>({ maxSize: 3 });

      cache.set('a', 1); // LRU: a
      cache.set('b', 2); // LRU: a, b
      cache.set('c', 3); // LRU: a, b, c

      // Update 'a' - should move to head
      cache.set('a', 10); // LRU: b, c, a

      // Add 4th item - should evict 'b'
      cache.set('d', 4); // LRU: c, a, d

      expect(cache.get('a')).toBe(10); // Still exists with updated value
      expect(cache.get('b')).toBeUndefined(); // Evicted
      expect(cache.get('c')).toBe(3);
      expect(cache.get('d')).toBe(4);
    });

    it('should maintain correct order after multiple operations', () => {
      const cache = new LRUCache<string, number>({ maxSize: 3 });

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      // Access pattern: c -> a -> b
      cache.get('c');
      cache.get('a');
      cache.get('b');

      // LRU order should be: c, a, b (c is LRU)
      cache.set('d', 4); // Should evict 'c'

      expect(cache.get('c')).toBeUndefined();
      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBe(2);
      expect(cache.get('d')).toBe(4);
    });
  });

  describe('TTL Expiration', () => {
    it('should expire entries after TTL', async () => {
      const cache = new LRUCache<string, number>({ maxSize: 10, ttl: 100 });

      cache.set('a', 1);

      // Should exist immediately
      expect(cache.get('a')).toBe(1);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be expired
      expect(cache.get('a')).toBeUndefined();
      expect(cache.size).toBe(0); // Expired entry removed
    });

    it('should not expire entries without TTL', async () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 });

      cache.set('a', 1);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should still exist
      expect(cache.get('a')).toBe(1);
    });

    it('should refresh TTL on set()', async () => {
      const cache = new LRUCache<string, number>({ maxSize: 10, ttl: 100 });

      cache.set('a', 1);

      // Wait 50ms (half TTL)
      await new Promise(resolve => setTimeout(resolve, 50));

      // Update value - refreshes TTL
      cache.set('a', 2);

      // Wait another 75ms (total 125ms since first set, but only 75ms since update)
      await new Promise(resolve => setTimeout(resolve, 75));

      // Should still exist (TTL refreshed)
      expect(cache.get('a')).toBe(2);
    });

    it('should handle has() with expired entries', async () => {
      const cache = new LRUCache<string, number>({ maxSize: 10, ttl: 100 });

      cache.set('a', 1);

      expect(cache.has('a')).toBe(true);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(cache.has('a')).toBe(false);
      expect(cache.size).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should track hits and misses', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 });

      cache.set('a', 1);

      // 2 hits
      cache.get('a');
      cache.get('a');

      // 2 misses
      cache.get('b');
      cache.get('c');

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should track evictions', () => {
      const cache = new LRUCache<string, number>({ maxSize: 2 });

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3); // Evicts 'a'
      cache.set('d', 4); // Evicts 'b'

      const stats = cache.getStats();
      expect(stats.evictions).toBe(2);
    });

    it('should track expirations', async () => {
      const cache = new LRUCache<string, number>({ maxSize: 10, ttl: 100 });

      cache.set('a', 1);
      cache.set('b', 2);

      await new Promise(resolve => setTimeout(resolve, 150));

      // Access expired entries
      cache.get('a');
      cache.get('b');

      const stats = cache.getStats();
      expect(stats.expirations).toBe(2);
    });

    it('should reset statistics on clear()', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 });

      cache.set('a', 1);
      cache.get('a');
      cache.get('missing');

      cache.clear();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.evictions).toBe(0);
      expect(stats.size).toBe(0);
    });

    it('should calculate correct hit rate', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 });

      // Hit rate should be 0 with no requests
      expect(cache.getStats().hitRate).toBe(0);

      cache.set('a', 1);

      // 3 hits, 1 miss = 75% hit rate
      cache.get('a');
      cache.get('a');
      cache.get('a');
      cache.get('missing');

      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0.75);
    });
  });

  describe('Access Order Tracking', () => {
    it('should return keys in access order (MRU first)', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 });

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      // Access pattern: b -> a
      cache.get('b');
      cache.get('a');

      const keys = cache.keys();
      expect(keys).toEqual(['a', 'b', 'c']); // a is MRU, c is LRU
    });

    it('should return values in access order', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 });

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      cache.get('c');
      cache.get('b');

      const values = cache.values();
      expect(values).toEqual([2, 3, 1]); // b is MRU, a is LRU
    });

    it('should return entries in access order', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 });

      cache.set('a', 1);
      cache.set('b', 2);

      cache.get('a'); // Move 'a' to head

      const entries = cache.entries();
      expect(entries).toEqual([
        ['a', 1],
        ['b', 2]
      ]);
    });
  });

  describe('Edge Cases', () => {
    it('should throw error for invalid maxSize', () => {
      expect(() => {
        new LRUCache<string, number>({ maxSize: 0 });
      }).toThrow('maxSize must be greater than 0');

      expect(() => {
        new LRUCache<string, number>({ maxSize: -1 });
      }).toThrow('maxSize must be greater than 0');
    });

    it('should handle maxSize of 1', () => {
      const cache = new LRUCache<string, number>({ maxSize: 1 });

      cache.set('a', 1);
      expect(cache.get('a')).toBe(1);

      cache.set('b', 2); // Should evict 'a'
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBe(2);
    });

    it('should handle complex objects as keys', () => {
      type Key = { id: string };
      const cache = new LRUCache<Key, number>({ maxSize: 10 });

      const key1 = { id: 'a' };
      const key2 = { id: 'b' };

      cache.set(key1, 1);
      cache.set(key2, 2);

      expect(cache.get(key1)).toBe(1);
      expect(cache.get(key2)).toBe(2);
    });

    it('should handle complex objects as values', () => {
      type Value = { data: string; count: number };
      const cache = new LRUCache<string, Value>({ maxSize: 10 });

      cache.set('a', { data: 'test', count: 42 });

      expect(cache.get('a')).toEqual({ data: 'test', count: 42 });
    });

    it('should handle empty cache operations', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 });

      expect(cache.size).toBe(0);
      expect(cache.get('missing')).toBeUndefined();
      expect(cache.has('missing')).toBe(false);
      expect(cache.delete('missing')).toBe(false);
      expect(cache.keys()).toEqual([]);
      expect(cache.values()).toEqual([]);
      expect(cache.entries()).toEqual([]);
    });

    it('should handle single entry operations', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 });

      cache.set('a', 1);

      expect(cache.size).toBe(1);
      expect(cache.keys()).toEqual(['a']);
      expect(cache.values()).toEqual([1]);
      expect(cache.entries()).toEqual([['a', 1]]);

      cache.delete('a');

      expect(cache.size).toBe(0);
      expect(cache.keys()).toEqual([]);
    });
  });

  describe('Performance Characteristics', () => {
    it('should handle large number of entries efficiently', () => {
      const cache = new LRUCache<number, string>({ maxSize: 1000 });

      // Set 2000 entries (should evict 1000)
      for (let i = 0; i < 2000; i++) {
        cache.set(i, `value-${i}`);
      }

      expect(cache.size).toBe(1000);

      // First 1000 should be evicted
      for (let i = 0; i < 1000; i++) {
        expect(cache.get(i)).toBeUndefined();
      }

      // Last 1000 should exist
      for (let i = 1000; i < 2000; i++) {
        expect(cache.get(i)).toBe(`value-${i}`);
      }
    });

    it('should maintain O(1) operations under load', () => {
      const cache = new LRUCache<number, number>({ maxSize: 10000 });

      // Fill cache
      for (let i = 0; i < 10000; i++) {
        cache.set(i, i);
      }

      // Measure access time
      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        cache.get(i);
      }
      const duration = Date.now() - start;

      // Should be very fast (< 50ms for 1000 operations)
      expect(duration).toBeLessThan(50);
    });
  });
});
