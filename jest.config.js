/** @type {import('jest').Config} */
module.exports = {
  // Use ts-jest preset for TypeScript
  preset: 'ts-jest',

  // Test environment
  testEnvironment: 'node',

  // Root directory
  roots: ['<rootDir>/src', '<rootDir>/tests'],

  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/__tests__/**/*.test.ts'
  ],

  // Module path aliases (match tsconfig paths)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // Transform ESM packages
  transformIgnorePatterns: [
    'node_modules/(?!(p-limit|yocto-queue)/)'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/index.ts'
  ],

  coverageDirectory: 'coverage',

  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // TypeScript transformation
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        // Allow importing .ts files without extension
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }],
    '^.+\\.js$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }]
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // Verbose output
  verbose: true,

  // Detect open handles (helps find async issues)
  detectOpenHandles: true,

  // Force exit after tests complete
  forceExit: false,

  // Test timeout (5 seconds default)
  testTimeout: 5000,

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};
