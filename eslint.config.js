import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json'
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'writable',
        NodeJS: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        require: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      // TypeScript推奨ルール
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      
      // 基本ルール
      'eqeqeq': ['error', 'always'],
      'no-implicit-coercion': 'error',
      'no-return-await': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      
      // 複雑度制限
      'complexity': ['warn', 12],
      'max-lines-per-function': ['warn', 120],
      'max-params': ['warn', 4],
      
      // コンソール使用は警告レベル（デバッグ用）
      'no-console': 'warn',
      
      // 未使用変数（JSとTS両方対応）
      'no-unused-vars': 'off' // TypeScriptルールを優先
    }
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly'
      }
    },
    rules: {
      'no-console': 'off' // ビルドスクリプトではコンソール出力を許可
    }
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'out/**',
      '*.d.ts'
    ]
  }
];