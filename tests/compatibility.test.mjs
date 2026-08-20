import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const execFileAsync = promisify(execFile);
const root = new URL("../../../hiapi-product-video-skills/", import.meta.url);

test("legacy install preserves local state and installs food adapter", async () => {
  const temp = await mkdtemp(join(tmpdir(), "hiapi-food-compat-"));
  const target = join(temp, "skills");
  const destination = join(target, "hiapi-food-commercial-video");
  try {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(join(destination, "outputs"), { recursive: true });
    await writeFile(join(destination, ".env"), "HIAPI_API_KEY=keep\n", "utf8");
    await writeFile(join(destination, "outputs", "draft.txt"), "keep", "utf8");
    await execFileAsync(process.execPath, ["scripts/install-compat.mjs", "--yes", `--target=${target}`], {
      cwd: new URL("..", import.meta.url), env: { ...process.env, HIAPI_PRODUCT_VIDEO_SKILLS_REPO: root.pathname },
    });
    assert.equal(await readFile(join(destination, ".env"), "utf8"), "HIAPI_API_KEY=keep\n");
    assert.equal(await readFile(join(destination, "outputs", "draft.txt"), "utf8"), "keep");
    await access(join(destination, "scripts", "hiapi-food-commercial-video.mjs"));
  } finally { await rm(temp, { recursive: true, force: true }); }
});
