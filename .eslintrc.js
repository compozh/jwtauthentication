/* eslint-disable */
module.exports = {
  'env': [
    'eslint:recommended',
    'plugin:vue/essential'
  ],

  'extends': [
    'eslint:recommended',
    'plugin:vue/essential'
  ],

  'plugins': [
    'vue'
  ],

  'rules': {
  },

  root: true,

  env: {
    browser: true,
    es6: true,
    node: true
  },

  rules: {
    'no-console': 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'indent': ['error', 2],
    'no-extra-semi':'error',
    'semi':['error','never'],
    'quotes':['error', 'single'],
    'curly':"error",
    "key-spacing": ["error", { "beforeColon": false, "afterColon": true, "mode": "strict"  }],
    'block-spacing': "error",
    "space-infix-ops": ["error", {"int32Hint": false}],
    "space-before-blocks":["error"],
    "keyword-spacing":["error"],
    "brace-style":["error","1tbs", { "allowSingleLine": true }],
    "arrow-spacing":["error"]

  },

  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
    parser: 'babel-eslint'
  }
}
