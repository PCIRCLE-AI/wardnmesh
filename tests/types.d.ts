/**
 * TypeScript type definitions for test environment
 */

// Allow mocking global.fetch in tests
declare global {
  namespace NodeJS {
    interface Global {
      fetch: typeof globalThis.fetch;
    }
  }
}

export {};
