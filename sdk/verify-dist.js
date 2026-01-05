const sdk = require("./dist/index.js");

try {
  if (sdk.YAAAClient) {
    console.log("SUCCESS: YAAAClient found in build output");
  } else {
    console.error("FAILURE: YAAAClient not found");
    process.exit(1);
  }
} catch (e) {
  console.error(e);
  process.exit(1);
}
