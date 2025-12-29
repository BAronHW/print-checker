import { execSync } from "node:child_process";
import path from "node:path";
import fsPromises from "fs/promises";

const FILES_WHITELIST = ['.ts', ''] 

const isGitRepo = (): boolean => {
  try {
    execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

const getChangedFiles = (): string[] => {
  const repoRoot = execSync("git rev-parse --show-toplevel", { encoding: "utf-8" }).trim();
  const diffOutput = execSync("git status --porcelain", { encoding: "utf-8" });

  return diffOutput
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => path.join(repoRoot, line.slice(3)));
};

const fileContainsText = async (filePath: string, text: string): Promise<boolean> => {
  const contents = await fsPromises.readFile(filePath, "utf-8");
  return contents.includes(text);
};

const main = async () => {
  if (!isGitRepo()) {
    console.error("Error: No git repository found in your current working directory");
    process.exit(1);
  }

  const files = getChangedFiles();
  const results = await Promise.all(
    files.map(async (file) => ({
      file,
      hasConsoleLog: await fileContainsText(file, "console.log"),
    }))
  );

  console.log(results);
};

main();