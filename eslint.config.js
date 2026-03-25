// eslint.config.js
import perfectionist from 'eslint-plugin-perfectionist'

export default [
  perfectionist.configs['recommended-alphabetical'],
  perfectionist.configs['recommended-line-length'],
  {
    plugins: {
      perfectionist,
    },
    rules: {
      'perfectionist/sort-interfaces': ['error'],
      'perfectionist/sort-objects': ['error', {
        type: 'alphabetical',
      }],
    },
    settings: {
      perfectionist: {
        partitionByComment: true,
        type: 'line-length',
      },
    },
  },
]