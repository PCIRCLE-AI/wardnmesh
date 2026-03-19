/**
 * Jest setup file - runs before all tests
 */

// Make this file a module
export {};

// Extend Jest matchers if needed
expect.extend({
  // Custom matcher example
  toBeValidHallucinationIssue(received: any) {
    const hasRequiredFields =
      typeof received === 'object' &&
      'type' in received &&
      'severity' in received &&
      'message' in received;

    return {
      pass: hasRequiredFields,
      message: () => hasRequiredFields
        ? `Expected ${JSON.stringify(received)} not to be a valid hallucination issue`
        : `Expected ${JSON.stringify(received)} to be a valid hallucination issue (missing required fields)`
    };
  }
});

// Custom matcher types are declared in custom-matchers.d.ts

// Set up global test timeout
jest.setTimeout(10000); // 10 seconds for all tests

// Suppress console.log in tests (uncomment if needed)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };

console.log('🧪 Test environment initialized');
