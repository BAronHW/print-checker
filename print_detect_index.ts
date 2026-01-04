#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import chalk from 'chalk';
import readline from 'node:readline/promises';
import { access, readdir, readFile, rename, writeFile } from 'node:fs/promises';

/**
 * 1. maybe add reference to line and row detected
 * 2. add this to precommit hook - need to test on linux based system
 * 3. publish to npm?
 * 4. need to have the script compile on first install
 * 5. need to make it work on both win32 and linux systems
 * 6. find better way make the pre-hook script work better?
 */

export interface PrintCheckConfig  {
  fileExtensions: string[];
  warnOnly: boolean;
  searchTerms: string[];
  hasLineDetails: boolean;
};

const setupBashScriptToHook = async () => {
  const repoRoot = await getRepoRoot();
  const hooksDir = path.join(repoRoot, '.git', 'hooks');
  const preCommitPath = path.join(hooksDir, 'pre-commit');

  try {
    await access(preCommitPath);

    const files = await readdir(hooksDir);
    const oldHooks = files.filter(f => f.match(/^pre-commit\d*\.old$/));
    const nextIndex = oldHooks.length;

    const backupName = nextIndex === 0 ? 'pre-commit.old' : `pre-commit${nextIndex}.old`;
    const backupPath = path.join(hooksDir, backupName);

    await rename(preCommitPath, backupPath);
    console.log(chalk.yellow(`Existing pre-commit hook renamed to ${backupName}`));
  } catch (error) {

  }

  const hookScript = `#!/bin/sh
  # Auto-generated pre-commit hook for print_check

  # Call old hook if it exists
  if [ -f .git/hooks/pre-commit.old ]; then
    .git/hooks/pre-commit.old
    OLD_EXIT=$?
    if [ $OLD_EXIT -ne 0 ]; then
      exit $OLD_EXIT
    fi
  fi

  # Run print-check
  REPO_ROOT=$(git rev-parse --show-toplevel)
  # Run the script with node
  # Redirect stdin from terminal so script can read user input
  node "$REPO_ROOT/dist/print_detect_index.js" < /dev/tty
  exit $?
  `;

  const newHookPath = path.join(hooksDir, 'pre-commit');
  await writeFile(newHookPath, hookScript, { mode: 0o755 });
  console.log(chalk.green('Created new pre-commit hook that chains old hook and print-check'));
}

export const checkForConfigFile = async (): Promise<PrintCheckConfig | null> => {
  try {
    const filePath = path.join(process.cwd(), 'print_check_config.json');
    const jsonFile = await readFile(filePath, { encoding: 'utf8' });
    const parsedJsonFile: PrintCheckConfig  = JSON.parse(jsonFile);

    if (!Array.isArray(parsedJsonFile.fileExtensions) ||
        typeof parsedJsonFile.warnOnly !== 'boolean' ||
        !Array.isArray(parsedJsonFile.searchTerms)) {
      console.log(chalk.yellow('Invalid config file, creating new one'));
      return null;
    }

    return parsedJsonFile;
  } catch (error) {
    return null;
  }
}

export const createConfigFile = async (userInput: PrintCheckConfig): Promise<boolean> => {
  try {
    const stringifiedData = JSON.stringify(userInput, null, 2);
    const configPath = path.join(process.cwd(), 'print_check_config.json')
    await writeFile(configPath, stringifiedData);
    console.log(chalk.blue('Successfully created config file'));
    return true;
  } catch (error) {
    console.log(chalk.red('Failed to create config file'));
    console.error(error);
    return false;
  }
}

export const normalizeQuestionResp = (
  fileExtensions: string, 
  warnOnly: string, 
  searchTerms: string,
  hasLineDetails: string
): PrintCheckConfig  => {

  
  const trimAndSplitExt = fileExtensions
    .trim()
    .split(',')

  const invalidExtensions = trimAndSplitExt
    .filter((ext) => !ext.startsWith('.'))

  if (invalidExtensions.length > 0) {
    throw new Error(`Invalid extensions (extensions must start with '.') Invalid Extensions: ${invalidExtensions}`)
  }

  const warnLower = warnOnly.toLowerCase();
  if (warnLower !== 'y' && warnLower !== 'n') {
    throw new Error('Please answer y or n');
  }

  const lineDetail = hasLineDetails.toLowerCase();
  if (lineDetail !== 'y' && lineDetail !== 'n') {
    throw new Error('Please answer y or n');
  }

  const warnFlag = warnLower === 'y';
  const lineDetailFlag = lineDetail === 'y';
  const terms = searchTerms
    .split(',')
    .map(terms => terms.trim());

  const returnObj: PrintCheckConfig  = {
    fileExtensions: trimAndSplitExt,
    warnOnly: warnFlag,
    searchTerms: terms,
    hasLineDetails: lineDetailFlag
  }

  return returnObj;

}

const setupQuestions = async (): Promise<PrintCheckConfig> => {

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const fileExtension = await rl.question('Enter file extensions with the . in the beginning (comma-separated)');
  const warnOnly = await rl.question('Warn only without blocking? (y/n): ');
  const searchTerms = await rl.question('Enter patterns to search (comma-separated)');
  const hasLineDetails = await rl.question('Show line details for each print statement? (y/n): ')

  const resObj = normalizeQuestionResp(
    fileExtension, 
    warnOnly, 
    searchTerms,
    hasLineDetails
  );

  rl.close();
  return resObj;
  
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
    const child = spawn('git', ['diff', '--cached', '--name-only', '--diff-filter=d', '-z']);
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

const getChangedFiles = async (fileExtensions: string[]): Promise<string[]> => {
  const repoRoot = await getRepoRoot();
  const diffOutput = await getDiffOutputs()
  const normalizedRoot =  path.normalize(repoRoot.trim());
  return diffOutput
    .split('\0')
    .filter(Boolean)
    .map((entry) => path.join(normalizedRoot, entry))
    .filter((fileName) => fileExtensions.some(ext => fileName.endsWith(ext)))
};

const findPrintStatements = async (
  files: string[], 
  printStatement: string[],
  hasLineDetails: boolean
): Promise<string[]> => {

  if (files.length === 0) return [];

  const patternArgs = printStatement.flatMap(p => ['-e', p]);
  const repoRoot = await getRepoRoot()

  const lineDetailArg: string =
    hasLineDetails == true ? '-n' : '-l' 
  
  return new Promise((resolve) => {
    const child = spawn('git', [
      'grep', '--cached', lineDetailArg, ...patternArgs, '--', ...files
    ]);
    
    const chunks: Buffer[] = [];
    child.stdout.on('data', (data) => chunks.push(data));
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve(
          Buffer.concat(chunks)
            .toString()
            .trim()
            .split('\n')
            .map((filePath) => path.join(repoRoot, filePath))
        );
      } else {
        resolve([]);
      }
    });
  });
};

const confirmProceed = async (): Promise<boolean> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await rl.question('Print statements detected. Continue anyway? (y/n): ');
  rl.close();
  
  return answer.toLowerCase() === 'y';
};

const main = async () => {
  if (!await isGitRepo()) {
    console.error('Error: No git repository found in your current working directory');
    process.exit(1);
  }

  const existing = await checkForConfigFile();
  
  if (!existing) {
    setupBashScriptToHook();
  }

  const config = existing ?? await (async () => {
    const newConfig = await setupQuestions();
    await createConfigFile(newConfig);
    return newConfig;
  })()

  const { fileExtensions, warnOnly, searchTerms, hasLineDetails } = config

  const files = await getChangedFiles(fileExtensions);
  const filesWithPrint = await findPrintStatements(files, searchTerms, hasLineDetails);

  if (filesWithPrint.length > 0) {
    throwWarnings(filesWithPrint);

    if (warnOnly) {
      const shouldProceed = await confirmProceed();
      if (!shouldProceed) {
        console.log(chalk.red('Commit aborted.'));
        process.exit(1);
      }
    } else {
      console.log(chalk.red('Commit blocked due to print statements.'));
      process.exit(1);
    }
  }
  process.exit(0);
};

main();