module.exports = {
  moduleNameMapper: {
    'src/rr': '<rootDir>/src/recursiveReducer',
    'src/(.*)': '<rootDir>/src/$1',
  },
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test|doctest).+(ts|tsx|js)',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/test/',
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    }
  },
  collectCoverageFrom: [
    'src/*.{js,ts}'
  ]
};
