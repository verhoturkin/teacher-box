// @ts-check
const fs = require('node:fs');
const path = require('node:path');
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

const FEATURES_DIR = path.join(__dirname, 'src/app/features');
const features = fs.existsSync(FEATURES_DIR)
  ? fs
      .readdirSync(FEATURES_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  : [];

/** Relative imports may climb at most one level; use @core/@shared/@features aliases otherwise. */
const NO_DEEP_RELATIVE = {
  regex: '^(\\.\\./){2,}',
  message: 'Use the @core/*, @shared/* or @features/* aliases instead of deep relative imports.',
};

/** React and Excalidraw are a lazy island (ADR-0028): only the board editor may import them. */
const NO_REACT = {
  regex: '^(react|react-dom)(/|$)|^@excalidraw/',
  message: 'React and Excalidraw are imported only in features/boards/editor/ (ADR-0028).',
};

/** The media library of the calls is a lazy chunk (ADR-0030): only its adapter may import it. */
const NO_LIVEKIT = {
  regex: '^livekit-client$',
  message:
    'livekit-client is imported only in features/meetings/call/livekit-engine.ts (ADR-0030).',
};

/** The board editor folder: the only place allowed to import React and Excalidraw. */
const BOARD_EDITOR_FILES = ['src/app/features/boards/editor/**/*.ts'];

/** Builds no-restricted-imports options: the global rules plus area-specific patterns. */
function restrictImports(...patterns) {
  return ['error', { patterns: [NO_DEEP_RELATIVE, NO_REACT, NO_LIVEKIT, ...patterns] }];
}

/**
 * Feature boundaries (AGENTS.md §4.2 rule 6): other features only via their public entries —
 * @features/<name> (pages) and @features/<name>/parts (widgets, panels, data access).
 */
function featureBoundary(feature) {
  return {
    regex: `^@features/(?!${feature}/)[^/]+/(?!parts$)`,
    message:
      'Import other features only through their public API: @features/<name> or @features/<name>/parts.',
  };
}

/**
 * Feature directions (ADR-0058; mirrored in frontend/AGENTS.md): which features a feature may
 * import. The table is the screen-embedding order of the frontend, not a copy of the backend one.
 *
 * - Base features know no business feature; `identity` may use `help`.
 * - Business features import the base ones and the business features listed here.
 * - Composition features assemble screens from base and business features; nothing imports them,
 *   except the composition features listed here.
 *
 * A new feature gets a row; a new arrow must keep the graph acyclic (scripts/import-cycles.mjs).
 */
const BASE_FEATURES = { help: [], identity: ['help'] };
const BUSINESS_FEATURES = {
  ai: [],
  boards: [],
  meetings: [],
  notifications: [],
  textbooks: ['boards'],
  billing: ['notifications'],
  homework: ['ai', 'boards', 'textbooks'],
  schedule: ['ai', 'boards', 'homework', 'meetings'],
};
const COMPOSITION_FEATURES = {
  account: [],
  admin: ['settings'],
  gallery: [],
  home: [],
  materials: [],
  settings: [],
  students: [],
};

/**
 * Violations known when the rule was introduced, emptied by stages 370.2–370.3: a file → the extra
 * features it still imports. Never add to this list.
 */
const PENDING_DIRECTIONS = {
  'homework/teacher/assignment-editor-page.ts': ['schedule'],
  'homework/teacher/next-lesson.ts': ['schedule'],
};

/** The features `feature` may import, by the table above. */
function allowedFeatures(feature) {
  const base = Object.keys(BASE_FEATURES);
  if (feature in BASE_FEATURES) return BASE_FEATURES[feature];
  if (feature in BUSINESS_FEATURES) return [...base, ...BUSINESS_FEATURES[feature]];
  if (feature in COMPOSITION_FEATURES) {
    return [...base, ...Object.keys(BUSINESS_FEATURES), ...COMPOSITION_FEATURES[feature]];
  }
  throw new Error(
    `Feature "${feature}" has no row in the feature directions of eslint.config.js (ADR-0058).`,
  );
}

/** Forbids every feature that `feature` may not import; `extra` — pending violations of one file. */
function featureDirection(feature, extra = []) {
  const allowed = [feature, ...allowedFeatures(feature), ...extra];
  return {
    regex: `^@features/(?!(?:${allowed.join('|')})(?:/|$))`,
    message: `Feature "${feature}" may import only: ${allowedFeatures(feature).join(', ') || 'no other feature'} (ADR-0058, frontend/AGENTS.md).`,
  };
}

/** Both feature rules of a file of `feature`. */
function featureRules(feature, extra) {
  return [featureBoundary(feature), featureDirection(feature, extra)];
}

const featureBoundaries = [
  ...features.map((feature) => ({
    files: [`src/app/features/${feature}/**/*.ts`],
    rules: { 'no-restricted-imports': restrictImports(...featureRules(feature)) },
  })),
  ...Object.entries(PENDING_DIRECTIONS).map(([file, extra]) => ({
    files: [`src/app/features/${file}`],
    rules: {
      'no-restricted-imports': restrictImports(...featureRules(file.split('/')[0], extra)),
    },
  })),
];

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
      '@typescript-eslint/no-explicit-any': [
        'error',
        { fixToUnknown: true, ignoreRestArgs: false },
      ],
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
    files: ['src/app/features/meetings/call/livekit-engine.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [NO_DEEP_RELATIVE, NO_REACT, ...featureRules('meetings')] },
      ],
    },
  },
  {
    files: BOARD_EDITOR_FILES,
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [NO_DEEP_RELATIVE, ...featureRules('boards')] },
      ],
    },
  },
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
