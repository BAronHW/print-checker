import { exec, execSync } from "node:child_process";
import readline from 'node:readline';

const isGitRepo = (cwd: string): Promise<boolean> => {
    return new Promise((resolve) => {
        exec("git rev-parse --is-inside-work-tree", { cwd }, (err, stdout) => {
            if (err) return resolve(false);
            resolve(stdout.trim() === "true");
        });
    })
}

const getUserReqs = () => {

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    rl.question(`What's your name?`, name => {
        console.log(`Hi ${name}!`);
        rl.close();
    });

}

const getChangedFiles = (): string[] => {
  try {
    const diffOutput = execSync('git status --porcelain', { encoding: 'utf-8' });
    return diffOutput.trim().split('\n').filter(Boolean);
  } catch (error: any) {
    console.error('Unable to get changed files');
  }
}

const main = async () => {
    /**
     * 1. first get the current directory that the user is in
     * 2. try to see if there is a git repo in the current working directory
     * 3. if there is then return a list of all modified things and also all new files
     */
    const cwd = process.cwd();
    getUserReqs();
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