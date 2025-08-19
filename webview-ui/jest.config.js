/** @type {import('jest').Config} */
module.exports = {
  // A preset that is used as a base for Jest's configuration
  preset: 'ts-jest',

  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json'
    }]
  },

  // The test environment that will be used for testing
  testEnvironment: 'jest-environment-jsdom',

  // The root directory that Jest should scan for tests and modules within
  rootDir: '.',

  // A list of paths to directories that Jest should use to search for files in
  roots: ['<rootDir>/src'],

  // The glob patterns Jest uses to detect test files
  testMatch: [
    '**/__tests__/**/*.test.tsx',
    '**/?(*.)+(spec|test).tsx'
  ],

  // An array of regexp pattern strings that are matched against all test paths, matched tests are skipped
  testPathIgnorePatterns: [
    '/node_modules/'
  ],

  // A map from regular expressions to module names or to arrays of module names that allow to stub out resources with a single module
  moduleNameMapper: {
    // Handle CSS imports (if any)
    '\\.css$': 'identity-obj-proxy',
  },

  // Setup files to run before each test file
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
