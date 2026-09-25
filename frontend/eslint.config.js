// @ts-check
const fs = require('node:fs');
const path = require('node:path');
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

const FEATURES_DIR = path.join(__dirname, 'src/app/features');
const features = fs.existsSync(FEATURES_DIR)
  ? fs.readdirSync(FEATURES_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  : [];

/** Relative imports may climb at most one level; use @core/@shared/@features aliases otherwise. */
const NO_DEEP_RELATIVE = {
  regex: '^(\\.\\./){2,}',
  message: 'Use the @core/*, @shared/* or @features/* aliases instead of deep relative imports.',
};

/** Builds no-restricted-imports options: the global rule plus area-specific patterns. */
function restrictImports(...patterns) {
  return ['error', { patterns: [NO_DEEP_RELATIVE, ...patterns] }];
}

/** Feature boundaries (AGENTS.md §4.2 rule 6): other features only via their public index. */
const featureBoundaries = features.map((feature) => ({
  files: [`src/app/features/${feature}/**/*.ts`],
  rules: {
    'no-restricted-imports': restrictImports({
      regex: `^@features/(?!${feature}/)[^/]+/`,
      message: 'Import other features only through their public API: @features/<name>.',
    }),
  },
}));

module.exports = defineConfig([
  { ignores: ['dist/', 'coverage/', '.angular/', 'node_modules/'] },
  {
    // Inline `eslint-disable` comments are not allowed: fix the code instead.
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' },
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      angular.configs.tsRecommended,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'tb', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'tb', style: 'kebab-case' },
      ],
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      '@angular-eslint/prefer-signals': 'error',
      '@angular-eslint/no-async-lifecycle-method': 'error',
      // "No any" policy (AGENTS.md §6.3).
      '@typescript-eslint/no-explicit-any': ['error', { fixToUnknown: true, ignoreRestArgs: false }],
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-type-assertion': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'no-public' }],
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      // Angular validators are static methods (Validators.required) and do not use `this`.
      '@typescript-eslint/unbound-method': ['error', { ignoreStatic: true }],
      'no-restricted-imports': restrictImports(),
    },
  },
  {
    files: ['src/app/core/**/*.ts', 'src/app/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': restrictImports({
        regex: '^@features/',
        message: 'core/ and shared/ must not depend on features.',
      }),
    },
  },
  ...featureBoundaries,
  {
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      // expect(service.method).toHaveBeenCalled() passes spied methods unbound by design.
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {
      '@angular-eslint/template/prefer-control-flow': 'error',
      '@angular-eslint/template/no-any': 'error',
    },
  },
]);
