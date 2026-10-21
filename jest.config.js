
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    testMatch: ['**/*.test.ts', '**/*.spec.ts'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    setupFiles: ['dotenv/config'],
    collectCoverageFrom: ['src/**/*.ts', '!src/app.ts'],
    coverageDirectory: 'coverage',
};
