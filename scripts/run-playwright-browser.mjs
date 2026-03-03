import { spawnSync } from "node:child_process";

const env = { ...process.env };

delete env.NO_COLOR;
delete env.FORCE_COLOR;

const result = spawnSync("playwright", ["test", "--config=playwright.browser.config.ts", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: true,
  env,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
