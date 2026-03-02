module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
  },
  // @noble/curves and @noble/hashes are ESM-only — transform them so Jest can load them
  transformIgnorePatterns: [
    "node_modules/(?!(@noble/curves|@noble/hashes)/)",
  ],
};
