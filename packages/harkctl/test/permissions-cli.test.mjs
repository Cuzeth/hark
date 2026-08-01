import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { main } from "../src/permissions/cli.mjs";

test("setup all installs every adapter in one command", async () => {
  const home = await mkdtemp(join(tmpdir(), "hark-permissions-cli-"));
  const result = await main(["setup", "all"], {
    home,
    entrypoint: "/opt/hark/harkctl.mjs",
    checkAuthentication: async () => true,
    install: {
      platform: "darwin",
      runCommand: async () => {},
    },
  });
  assert.deepEqual(
    result.installed.map((item) => item.agent),
    ["claude", "codex", "opencode"],
  );
  const doctor = await main(["doctor"], {
    home,
    entrypoint: "/opt/hark/harkctl.mjs",
    checkAuthentication: async () => true,
  });
  assert.deepEqual(doctor, {
    authenticated: true,
    installed: { claude: true, codex: true, opencode: { v1: true, v2: true } },
  });
});

test("setup refuses to write configs before Hark authentication", async () => {
  const home = await mkdtemp(join(tmpdir(), "hark-permissions-cli-"));
  await assert.rejects(
    main(["setup", "claude"], {
      home,
      entrypoint: "/opt/hark/harkctl.mjs",
      checkAuthentication: async () => false,
    }),
    /not authenticated/,
  );
});

test("setup all on Linux installs supported hooks and reports the OpenCode skip", async () => {
  const home = await mkdtemp(join(tmpdir(), "hark-permissions-cli-"));
  const result = await main(["setup", "all"], {
    home,
    entrypoint: "/opt/hark/harkctl",
    checkAuthentication: async () => true,
    install: { platform: "linux" },
  });
  assert.deepEqual(
    result.installed.map((item) => item.agent),
    ["claude", "codex"],
  );
  assert.match(result.warnings[0], /Skipped OpenCode/);
});
