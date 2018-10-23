module.exports = function (wallaby) {
  return {
    name: 'bbot-slack',
    files: [
      'src/**/*.ts',
      'package.json',
      { pattern: 'src/**/*.d.ts', ignore: true },
      { pattern: '.env', instrument: false }
    ],
    tests: ['test/*.spec.ts'],
    testFramework: 'mocha',
    env: { type: 'node' },
    compilers: {
      '**/*.ts?(x)': wallaby.compilers.typeScript({ module: 'commonjs' })
    },
    debug: true,
    slowTestThreshold: 200,
    delays: { run: 2500 },
    setup: () => require('dotenv').config()
  }
}
