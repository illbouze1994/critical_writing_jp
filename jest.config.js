/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/*.test.ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  moduleNameMapper: {
    '^vscode$': '<rootDir>/src/__tests__/__mocks__/vscode.ts',
    '^../features/keyword-engine$': '<rootDir>/src/__tests__/__mocks__/keyword-engine.ts',
    '^../features/roi-engine$': '<rootDir>/src/__tests__/__mocks__/roi-engine.ts',
    '^../features/style-checker$': '<rootDir>/src/__tests__/__mocks__/style-checker.ts',
    '^../features/citation-checker$': '<rootDir>/src/__tests__/__mocks__/citation-checker.ts',
    '^./keyword-engine$': '<rootDir>/src/__tests__/__mocks__/keyword-engine.ts',
    '^./roi-engine$': '<rootDir>/src/__tests__/__mocks__/roi-engine.ts',
    '^./style-checker$': '<rootDir>/src/__tests__/__mocks__/style-checker.ts',
    '^./citation-checker$': '<rootDir>/src/__tests__/__mocks__/citation-checker.ts'
  },
  testTimeout: 10000,
  verbose: true
};