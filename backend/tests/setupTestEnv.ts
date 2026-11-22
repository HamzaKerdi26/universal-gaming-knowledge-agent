/**
 * Jest test environment setup.
 *
 * Makes `npm test` always target the dedicated, isolated test database
 * (`gaming_agent_test`) and never the development/production databases
 * (`gaming_agent`, `flyrank_db`, `task_api`, `postgres`).
 *
 * `dotenv.config()` in `src/config/env.ts` only fills in variables that are
 * absent from `process.env`, so setting DATABASE_URL here guarantees the test
 * target wins over whatever is in `.env`.
 *
 * Fail-closed: if no test configuration can be located, the suite refuses to run
 * instead of silently connecting to a protected database. The test helpers
 * perform record-level deletes, so connecting to the wrong database would
 * delete its data.
 */
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const TEST_DB_NAME = "gaming_agent_test";

function parseDbNameFromUrl(value: string): string {
  try {
    return new URL(value).pathname.replace(/^\//, "");
  } catch {
    return "";
  }
}

function assertTargetsTestDatabase(value: string, source: string): void {
  if (parseDbNameFromUrl(value) !== TEST_DB_NAME) {
    throw new Error(
      "Refusing to run tests: " +
        source +
        " does not target the isolated test database \"" +
        TEST_DB_NAME +
        "\". Refusing to connect to a protected database."
    );
  }
}

// An explicitly exported DATABASE_URL_TEST wins, but is still validated.
const explicitTestUrl = process.env.DATABASE_URL_TEST;
if (explicitTestUrl) {
  assertTargetsTestDatabase(explicitTestUrl, "DATABASE_URL_TEST");
  process.env.DATABASE_URL = explicitTestUrl;
} else {
  // Otherwise fall back to the git-ignored, test-only env file.
  const testEnvPath = path.resolve(__dirname, "..", ".env.test");
  if (!fs.existsSync(testEnvPath)) {
    throw new Error(
      "No test configuration found: " +
        testEnvPath +
        " is missing. Tests must not fall back to the development/production .env."
    );
  }
  dotenv.config({ path: testEnvPath, override: true });
  assertTargetsTestDatabase(process.env.DATABASE_URL ?? "", ".env.test");
}
