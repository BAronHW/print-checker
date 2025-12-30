import { spawn } from "node:child_process";
import os from 'os'
import path from "node:path";

/**
 * need to normalize to using POSIX paths
 */

interface OS {
  type: 'win32' | 'linux' | 'darwin'
}

const spawnAsync = (command: string, args: string[]): Promise<{ code: number; stdout: string }> => {
  return new Promise((resolve) => {
    const child = spawn(command, args);
    let stdout = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout });
    });
  });
};

const isGitRepo = async (): Promise<boolean> => {
  const { code } = await spawnAsync("git", ["rev-parse", "--is-inside-work-tree"]);
  return code === 0;
};

const getChangedFiles = async (): Promise<string[]> => {
  const { stdout: repoRoot } = await spawnAsync("git", ["rev-parse", "--show-toplevel"]);
  const { stdout: diffOutput } = await spawnAsync("git", ["status", "--porcelain"]);
  const normalizedRoot =  path.normalize(repoRoot.trim());
  
  return diffOutput
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((diffFile) => path.join(normalizedRoot, diffFile.trim().split(' ')[1]))
};

const fileContainsText = (text: string, filePath: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const child = spawn("git", ["grep", "-q", text, "--", filePath], {
      stdio: "ignore",
    });

    child.on("close", (code) => {
      resolve(code === 0);
    });
  });
};

const main = async () => {
  if (!await isGitRepo()) {
    console.error("Error: No git repository found in your current working directory");
    process.exit(1);
  }

  const files = await getChangedFiles();
  const results = await Promise.all(
    files.map(async (file) => ({
      file,
      hasConsoleLog: await fileContainsText("console.log", file),
    }))
  );

  console.log(results);
};

main();