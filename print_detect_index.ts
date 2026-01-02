import { spawn } from 'node:child_process';
import path from 'node:path';
import chalk from 'chalk';
import readline from 'node:readline/promises';
import { readFile, writeFile } from 'node:fs/promises';

/**
 * 1. grep doesnt work with utf-16 encoded files might need to find a way to deal with this
 * 2. maybe add reference to line and row detected
 * 3. add this to precommit hook - need to test on linux based system
 * 5. publish to npm?
 * 6. need to have the script compile on first install
 * 7. need to make it work on both win32 and linux systems
 * 8. find better way make the pre-hook script work better?
 */

interface PrintCheckConfig  {
  fileExtensions: string[];
  warnOnly: boolean;
  searchTerms: string[];
};

const getConfig = async (): Promise<PrintCheckConfig> => {
  const existing = await checkForConfigFile();
  if (existing) return existing;
  
  const newConfig = await setupQuestions();
  await createConfigFile(newConfig);
  return newConfig;
};

const checkForConfigFile = async (): Promise<PrintCheckConfig | null> => {
  try {
    const filePath = path.join(process.cwd(), 'print_check_config.json');
    const jsonFile = await readFile(filePath, { encoding: 'utf8' });
    const parsedJsonFile: PrintCheckConfig  = JSON.parse(jsonFile);
    return parsedJsonFile;
  } catch (error) {
    return null;
  }
}

const createConfigFile = async (userInput: PrintCheckConfig): Promise<boolean> => {
  try {
    const stringifiedData = JSON.stringify(userInput, null, 2);
    const configPath = path.join(process.cwd(), 'print_check_config.json')
    await writeFile(configPath, stringifiedData);
    console.log(chalk.blue('Successfully created config file'));
    return true;
  } catch (error) {
    console.log(chalk.red('Failed to create config file'));
    return false;
  }
}

const normalizeQuestionResp = (
  fileExtensions: string, 
  warnOnly: string, 
  searchTerms: string
): PrintCheckConfig  => {

  const extensions = fileExtensions.trim().split(',').map(ext => ext.trim());
  const warnFlag = warnOnly === 'y' ? true : false;
  const terms = searchTerms.split(',').map(terms => terms.trim());

  const returnObj: PrintCheckConfig  = {
    fileExtensions: extensions,
    warnOnly: warnFlag,
    searchTerms: terms
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

  const resObj = normalizeQuestionResp(
    fileExtension, 
    warnOnly, 
    searchTerms
  );

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
    const child = spawn('git', ['status', '--porcelain', '-z']);
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
    .map((entry) => {
      if (entry.startsWith('R')) {
        return null;
      }
      return path.join(normalizedRoot, entry.slice(3));
    })
    .filter((fileName) => [...fileExtensions].some(ext => fileName.endsWith(ext)))
};

const findPrintStatements = async (
  files: string[], 
  printStatement: string[]
): Promise<string[]> => {

  if (files.length === 0) return [];

  const patternArgs = printStatement.flatMap(p => ['-e', p]);
  const repoRoot = await getRepoRoot()
  
  return new Promise((resolve) => {
    const child = spawn('git', [
      'grep', '-l', '--no-index', ...patternArgs, '--', ...files
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
            .map(file => path.join(repoRoot, file))
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

  const config = await getConfig();
  const { fileExtensions, warnOnly, searchTerms } = config;

  const files = await getChangedFiles(fileExtensions);
  const filesWithPrint = await findPrintStatements(files, searchTerms);

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