import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Load `backend/.env` (this file lives in `backend/src/`). */
export function loadBackendEnv(): void {
  const fromPackageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
  const fromCwd = join(process.cwd(), ".env");
  for (const path of [fromCwd, fromPackageRoot]) {
    if (existsSync(path)) {
      // Cursor/some shells inject empty env vars (e.g. WORKFLOW_REGISTRY_ADDRESS="");
      // default dotenv does not override existing keys, so .env would be ignored.
      config({ path, override: true });
      return;
    }
  }
}
