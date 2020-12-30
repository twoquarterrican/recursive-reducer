module.exports = {
  moduleNameMapper: {
  //   'src/rr': '<rootDir>/src/recursiveReducer',
  //   'src/(.*)': '<rootDir>/src/$1',
  //   '([a-z]+)': '<rootDir>/src/$1',
  },
  moduleDirectories: ['node_modules','src'],
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
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    }
  },
  collectCoverageFrom: [
    'src/*.{js,ts}'
  ]
};
