/**
 * Custom Jest matcher type declarations
 */

declare namespace jest {
  interface Matchers<R> {
    toBeValidHallucinationIssue(): R;
  }
}

export {};
