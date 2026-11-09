import test from "node:test";
import assert from "node:assert/strict";
import { parseGitHubRepo } from "../dist/config/loader.js";

test("loader - parses git remote URLs correctly", () => {
  assert.equal(
    parseGitHubRepo("git@github.com:xifan2333/pi-ghwebhook.git"),
    "xifan2333/pi-ghwebhook",
  );
  assert.equal(
    parseGitHubRepo("https://github.com/xifan2333/pi-ghwebhook.git"),
    "xifan2333/pi-ghwebhook",
  );
  assert.equal(
    parseGitHubRepo("https://github.com/xifan2333/pi-ghwebhook"),
    "xifan2333/pi-ghwebhook",
  );
  assert.equal(parseGitHubRepo("https://gitlab.com/user/repo.git"), null);
});
