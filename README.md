# print_check

A Git pre-commit hook that detects and prevents print/debug statements from being committed to your repository.

## Features

- Automatically scans staged files for print/debug statements before commits
- Configurable file extensions and search patterns
- Optional warning mode vs blocking mode
- Interactive setup with saved configuration
- Preserves existing pre-commit hooks
- Shows line details for detected statements (optional)

## Installation

```bash
npm install -g print_check
```

Or install as a dev dependency in your project:

```bash
npm install --save-dev print_check
```

## Usage

Run the command in your git repository:

```bash
print_check
```

On first run, you'll be prompted to configure:
- File extensions to check (e.g., `.js,.ts,.jsx,.tsx`)
- Search patterns (e.g., `console.log,console.error,debugger`)
- Warning mode (allow commit with confirmation) or blocking mode (prevent commit)
- Whether to show line details for each detected statement

Your configuration will be saved to `print_check_config.json` in your project root.

## Setup as Pre-commit Hook

To automatically run print_check before every commit, you can:

1. Just follow the setup by running print_check after downloading.

```

2. After completing the setup phase any terms found matching your search patterns will be flagged.

## Configuration

Example `print_check_config.json`:

```json
{
  "fileExtensions": [".js", ".ts", ".jsx", ".tsx"],
  "warnOnly": false,
  "searchTerms": ["console.log", "console.error", "debugger"],
  "hasLineDetails": true
}
```

- `fileExtensions`: Array of file extensions to check
- `warnOnly`: If true, prompts for confirmation; if false, blocks the commit
- `searchTerms`: Array of patterns to search for
- `hasLineDetails`: If true, shows line numbers and content for each match

## Requirements

- Node.js >= 18.0.0
- Git repository

## License

MIT
