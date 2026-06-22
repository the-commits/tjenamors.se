export default [
  {
    rules: {
      'max-len': ['error', 120],
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    ignores: [
      'dist/',
      'node_modules/',
      'src/build/',
      '.husky/',
      '.opencode/',
    ],
  },
];
