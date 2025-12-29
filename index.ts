import { exec, execSync } from "node:child_process";

const isGitRepo = (cwd: string): Promise<boolean> => {
    return new Promise((resolve) => {
        exec("git rev-parse --is-inside-work-tree", { cwd }, (err, stdout) => {
            if (err) return resolve(false);
            resolve(stdout.trim() === "true");
        });
    })
}

function getChangedFiles(extension: string = '') {
  const extensionFilter = extension ? `-- '***.${extension}'` : '';
  const command = `git diff HEAD^ HEAD --name-only ${extensionFilter}`;
  const diffOutput = execSync(command);
  return diffOutput.toString().split('\n').filter(Boolean);
}

const main = async () => {
    /**
     * 1. first get the current directory that the user is in
     * 2. try to see if there is a git repo in the current working directory
     * 3. if there is then return a list of all modified things and also all new files
     */
    const cwd = process.cwd();
    try {
        const inRepo = await isGitRepo(cwd);
        if (!inRepo) {
            console.error('Error: No git repository found in your current working directory');
            process.exit(1);
        }
        const files = getChangedFiles();
        console.log(files);
    } catch (err: any) {
        console.error(err);
    }

}

main();