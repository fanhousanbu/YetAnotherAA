module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*.spec.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: {
          // Minimal tsconfig for tests
          target: "ES2020",
          module: "commonjs",
          strict: false,
          esModuleInterop: true,
          skipLibCheck: true,
        },
      },
    ],
  },
  // Don't try to transform ox (raw .ts sources in node_modules) — mock it if needed
  transformIgnorePatterns: ["node_modules/(?!((@aastar|@yaaa)/))"],
  moduleNameMapper: {
    // Handle potential ESM imports
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  // Increase timeout for module initialization
  testTimeout: 30000,
};
