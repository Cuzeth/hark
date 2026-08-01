import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("the Hark skill reviews the current harkctl release", async () => {
  const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const repositoryRoot = join(packageRoot, "..", "..");
  const packageJson = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
  const skill = await readFile(join(repositoryRoot, "skills", "hark", "SKILL.md"), "utf8");
  assert.equal(skill.includes(`\`${packageJson.version}\` is reviewed`), true);
});
