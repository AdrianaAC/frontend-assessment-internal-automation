import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

// Clears Playwright's temporary workflow data before the browser suite starts.
async function globalSetup() {
  const playwrightDataDir = path.join(process.cwd(), ".data", "playwright");

  await rm(playwrightDataDir, { recursive: true, force: true });
  await mkdir(playwrightDataDir, { recursive: true });
}

export default globalSetup;
