/**
 * LRU Cache Implementation
 *
 * Generic least-recently-used cache with O(1) operations.
 *
 * Features:
 * - O(1) get, set, delete operations
 * - Automatic eviction when maxSize is reached
 * - TTL support (time-to-live)
 * - Doubly-linked list for access order tracking
 * - Map for O(1) key lookup
 *
 * Implementation:
 * - Uses Map<K, Node<K, V>> for O(1) key lookup
 * - Uses doubly-linked list for O(1) LRU eviction
 * - Head = most recently used
 * - Tail = least recently used
 */

/**
 * Node in doubly-linked list
 */
class LRUNode<K, V> {
  constructor(
    public key: K,
    public value: V,
    public timestamp: number,
    public prev: LRUNode<K, V> | null = null,
    public next: LRUNode<K, V> | null = null
  ) {}
}

/**
 * LRU Cache Options
 */
export interface LRUCacheOptions {
  /**
   * Maximum number of entries (required)
   */
  maxSize: number;

  /**
   * Time-to-live in milliseconds (optional)
   * Entries older than TTL are considered expired
   */
  ttl?: number;
}

/**
 * LRU Cache Statistics
 */
export interface LRUCacheStats {
  /** Current number of entries */
  size: number;

  /** Maximum number of entries */
  maxSize: number;

  /** Number of cache hits */
  hits: number;

  /** Number of cache misses */
  misses: number;

  /** Hit rate (hits / total requests) */
  hitRate: number;

  /** Number of evictions */
  evictions: number;

  /** Number of expired entries */
  expirations: number;
}

/**
 * Generic LRU Cache
 *
 * @example
 * const cache = new LRUCache<string, number>({ maxSize: 100, ttl: 60000 });
 * cache.set('key', 42);
 * const value = cache.get('key'); // 42
 */
export class LRUCache<K, V> {
  private cache: Map<K, LRUNode<K, V>>;
  private head: LRUNode<K, V> | null = null;
  private tail: LRUNode<K, V> | null = null;
  private maxSize: number;
  private ttl: number | undefined;

  // Statistics
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private expirations = 0;

  constructor(options: LRUCacheOptions) {
    if (options.maxSize <= 0) {
      throw new Error('maxSize must be greater than 0');
    }

    this.maxSize = options.maxSize;
    this.ttl = options.ttl;
    this.cache = new Map();
  }

  /**
   * Get value by key
   *
   * O(1) operation. Returns undefined if:
   * - Key doesn't exist
   * - Entry has expired (TTL exceeded)
   *
   * Side effects:
   * - Moves accessed node to head (most recently used)
   * - Removes expired entries
   *
   * @param key - Cache key
   * @returns Value or undefined
   */
  get(key: K): V | undefined {
    const node = this.cache.get(key);

    if (!node) {
      this.misses++;
      return undefined;
    }

    // Check if expired
    if (this.isExpired(node)) {
      this.delete(key);
      this.expirations++;
      this.misses++;
      return undefined;
    }

    // Move to head (most recently used)
    this.moveToHead(node);
    this.hits++;

    return node.value;
  }

  /**
   * Set key-value pair
   *
   * O(1) operation. Side effects:
   * - Updates existing entry and moves to head
   * - Evicts LRU entry if cache is full
   * - Adds new entry to head
   *
   * @param key - Cache key
   * @param value - Value to store
   */
  set(key: K, value: V): void {
    const existingNode = this.cache.get(key);

    if (existingNode) {
      // Update existing entry
      existingNode.value = value;
      existingNode.timestamp = Date.now();
      this.moveToHead(existingNode);
      return;
    }

    // Create new node
    const newNode = new LRUNode(key, value, Date.now());

    // Add to cache
    this.cache.set(key, newNode);

    // Add to head of linked list
    if (!this.head) {
      // First node
      this.head = newNode;
      this.tail = newNode;
    } else {
      newNode.next = this.head;
      this.head.prev = newNode;
      this.head = newNode;
    }

    // Evict LRU if over capacity
    if (this.cache.size > this.maxSize) {
      this.evictLRU();
    }
  }

  /**
   * Check if key exists (without updating access order)
   *
   * O(1) operation. Does not move node to head.
   * Removes expired entries.
   *
   * @param key - Cache key
   * @returns True if key exists and not expired
   */
  has(key: K): boolean {
    const node = this.cache.get(key);

    if (!node) {
      return false;
    }

    // Check if expired
    if (this.isExpired(node)) {
      this.delete(key);
      this.expirations++;
      return false;
    }

    return true;
  }

  /**
   * Delete entry by key
   *
   * O(1) operation. Removes node from linked list and map.
   *
   * @param key - Cache key
   * @returns True if entry was deleted
   */
  delete(key: K): boolean {
    const node = this.cache.get(key);

    if (!node) {
      return false;
    }

    // Remove from linked list
    this.removeNode(node);

    // Remove from map
    this.cache.delete(key);

    return true;
  }

  /**
   * Clear all entries
   *
   * O(1) operation. Resets cache and statistics.
   */
  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.expirations = 0;
  }

  /**
   * Get current cache size
   *
   * O(1) operation.
   *
   * @returns Number of entries
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   *
   * O(1) operation.
   *
   * @returns Cache statistics
   */
  getStats(): LRUCacheStats {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate,
      evictions: this.evictions,
      expirations: this.expirations,
    };
  }

  /**
   * Get all keys (in access order, most recent first)
   *
   * O(n) operation. Useful for debugging.
   *
   * @returns Array of keys
   */
  keys(): K[] {
    const keys: K[] = [];
    let current = this.head;

    while (current) {
      keys.push(current.key);
      current = current.next;
    }

    return keys;
  }

  /**
   * Get all values (in access order, most recent first)
   *
   * O(n) operation. Useful for debugging.
   *
   * @returns Array of values
   */
  values(): V[] {
    const values: V[] = [];
    let current = this.head;

    while (current) {
      values.push(current.value);
      current = current.next;
    }

    return values;
  }

  /**
   * Get all entries (in access order, most recent first)
   *
   * O(n) operation. Useful for debugging.
   *
   * @returns Array of [key, value] tuples
   */
  entries(): Array<[K, V]> {
    const entries: Array<[K, V]> = [];
    let current = this.head;

    while (current) {
      entries.push([current.key, current.value]);
      current = current.next;
    }

    return entries;
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  /**
   * Check if node has expired
   *
   * @param node - Node to check
   * @returns True if expired
   */
  private isExpired(node: LRUNode<K, V>): boolean {
    if (!this.ttl) {
      return false;
    }

    const age = Date.now() - node.timestamp;
    return age > this.ttl;
  }

  /**
   * Move node to head (most recently used)
   *
   * O(1) operation. Removes node from current position
   * and inserts at head.
   *
   * @param node - Node to move
   */
  private moveToHead(node: LRUNode<K, V>): void {
    if (node === this.head) {
      // Already at head
      return;
    }

    // Remove from current position
    this.removeNode(node);

    // Insert at head
    node.prev = null;
    node.next = this.head;

    if (this.head) {
      this.head.prev = node;
    }

    this.head = node;

    // Update tail if needed
    if (!this.tail) {
      this.tail = node;
    }
  }

  /**
   * Remove node from linked list
   *
   * O(1) operation. Updates prev/next pointers.
   *
   * @param node - Node to remove
   */
  private removeNode(node: LRUNode<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      // Node is head
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      // Node is tail
      this.tail = node.prev;
    }

    node.prev = null;
    node.next = null;
  }

  /**
   * Evict least recently used entry
   *
   * O(1) operation. Removes tail node.
   */
  private evictLRU(): void {
    if (!this.tail) {
      return;
    }

    const keyToEvict = this.tail.key;

    // Remove from linked list
    this.removeNode(this.tail);

    // Remove from map
    this.cache.delete(keyToEvict);

    this.evictions++;
  }
}
