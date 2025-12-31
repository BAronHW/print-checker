import { spawn } from 'node:child_process';
import path from 'node:path';
import chalk from 'chalk';

/**
 * 1. grep doesnt work with utf-16 encoded files might need to find a way to deal with this
 * 2. maybe add reference to line and row detected
 * 3. add this to precommit hook
 * 4. add setup stage questions
 * 5. publish to npm?
 */

interface filePathAndContains {
  file: string,
  hasConsoleLog: boolean
}

const setupQuestions = () => {
  /**
   * 1. what languages will you be writing in
   * 2. what do your files end in
   * 3. Do you want to block commits or just warn
   */
}

const throwWarnings = (filesWithConsoleLogs: string[]) => {
  filesWithConsoleLogs.forEach(pathObj => {
    console.error(chalk.red('WARNING:'), `print statement detected at ${chalk.blue(pathObj)}`)
  });
}

const isGitRepo = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    const child = spawn('git', ['rev-parse', '--is-inside-work-tree'], {
      stdio: 'ignore',
    });

    child.on('close', (code) => {
      resolve(code === 0);
    });
  });
};

const getRepoRoot = async (): Promise<string> => {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['rev-parse', '--show-toplevel']);
    const chunks: Buffer[] = [];

    child.stdout.on('data', (data) => {
      chunks.push(data);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks).toString().trim());
      } else {
        reject(new Error('Failed to get repo root'));
      }
    });
  });
};

const getDiffOutputs = async (): Promise<string> => {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['status', '--porcelain']);
    const chunks: Buffer[] = [];

    child.stdout.on('data', (data) => {
      chunks.push(data);
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn git: ${err.message}`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks).toString());
      } else {
        reject(new Error(`git status failed with code ${code}`));
      }
    });
  });
};

const getChangedFiles = async (): Promise<string[]> => {
  const repoRoot = await getRepoRoot();
  const diffOutput = await getDiffOutputs()
  const normalizedRoot =  path.normalize(repoRoot.trim());
  
  return diffOutput
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((diffFile) => path.join(normalizedRoot, diffFile.trim().split(' ')[1]))
};

const findPrintStatements = async (files: string[], printStatement: string): Promise<string[]> => {
  if (files.length === 0) return [];
  
  return new Promise((resolve) => {
    const child = spawn('git', [
      'grep', '-l', '--no-index', printStatement, '--', ...files
    ]);
    
    const chunks: Buffer[] = [];
    child.stdout.on('data', (data) => chunks.push(data));
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks).toString().trim().split('\n').filter(Boolean));
      } else {
        resolve([]);
      }
    });
  });
};

const main = async () => {
  if (!await isGitRepo()) {
    console.error('Error: No git repository found in your current working directory');
    process.exit(1);
  }

  const files = await getChangedFiles();
  const filesWithPrint = await findPrintStatements(files, 'console.log');

  if (filesWithPrint.length > 0) {
    throwWarnings(filesWithPrint);
    process.exit(1);
  }

  process.exit(0);
  
};

main();