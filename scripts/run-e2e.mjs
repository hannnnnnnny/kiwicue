import { spawn } from "node:child_process";
import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const localServerUrl = "http://127.0.0.1:3100";
const externalServerUrl = process.env.E2E_BASE_URL;
const nextCli = resolve(root, "node_modules/next/dist/bin/next");
const playwrightCli = resolve(root, "node_modules/@playwright/test/cli.js");
const buildDirectory = resolve(root, ".next");

async function materializeTests() {
  const source = resolve(root, "e2e");
  const destination = resolve(root, `.e2e-materialized-${process.pid}`);
  await mkdir(destination, { recursive: true });
  const files = (await readdir(source)).filter((file) => file.endsWith(".spec.ts"));
  await Promise.all(files.map((file) => copyFile(resolve(source, file), resolve(destination, file))));
  return destination;
}

async function removeMaterializedTests(directory) {
  const valid = dirname(directory) === root
    && directory.startsWith(resolve(root, ".e2e-materialized-"));
  if (!valid) throw new Error("Refusing to remove an unexpected E2E directory");
  await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

async function removeBuildDirectory() {
  const valid = dirname(buildDirectory) === root
    && buildDirectory === resolve(root, ".next");
  if (!valid) throw new Error("Refusing to remove an unexpected build directory");
  await rm(buildDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

function run(command, args, environment = process.env) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { cwd: root, env: environment, stdio: "inherit" });
    child.once("error", rejectRun);
    child.once("exit", (code) => code === 0
      ? resolveRun()
      : rejectRun(new Error(`${command} exited with code ${code ?? "unknown"}`)));
  });
}

async function waitForServer(server, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let healthySince = null;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`KiwiCue E2E server exited with code ${server.exitCode}`);
    }
    try {
      const response = await fetch(`${localServerUrl}/events`);
      if (response.ok) {
        healthySince ??= Date.now();
        if (Date.now() - healthySince >= 500) return;
      } else {
        healthySince = null;
      }
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      healthySince = null;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error("Timed out waiting for the KiwiCue E2E server");
}

async function stopServer(server) {
  if (server.exitCode !== null || !server.pid) return;
  server.kill();
  const closed = await Promise.race([
    new Promise((resolveClose) => server.once("exit", () => resolveClose(true))),
    new Promise((resolveWait) => setTimeout(() => resolveWait(false), 3_000)),
  ]);
  if (closed || process.platform !== "win32") return;
  await run("taskkill", ["/pid", String(server.pid), "/T", "/F"]);
}

let testDirectory;
let server;
const usesLocalServer = !externalServerUrl;

try {
  if (usesLocalServer) {
    await removeBuildDirectory();
    await run(process.execPath, [nextCli, "build"]);
  }
  testDirectory = await materializeTests();
  if (usesLocalServer) {
    server = spawn(process.execPath, [nextCli, "start", "--hostname", "127.0.0.1", "--port", "3100"], {
      cwd: root,
      env: process.env,
      stdio: "inherit",
    });
    await waitForServer(server);
  }
  await run(process.execPath, [playwrightCli, "test", ...process.argv.slice(2)], {
    ...process.env,
    E2E_BASE_URL: externalServerUrl ?? localServerUrl,
    E2E_TEST_DIR: testDirectory,
  });
} finally {
  if (server) await stopServer(server);
  if (testDirectory) await removeMaterializedTests(testDirectory);
  if (usesLocalServer) await removeBuildDirectory();
}
