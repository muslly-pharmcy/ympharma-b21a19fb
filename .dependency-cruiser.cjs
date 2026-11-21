/** Architecture audit: zero runtime dependencies, no production writes. */
module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    { name: 'no-orphans', severity: 'warn', from: { orphan: true, path: '^src/' }, to: {} },
    { name: 'no-cross-layer-server-imports', severity: 'error',
      from: { path: '^src/(pages|components|routes)/', pathNot: '\\.server\\.' },
      to: { path: '\\.server\\.[cm]?[jt]sx?$' } },
  ],
  options: {
    doNotFollow: { path: 'node_modules|\\.output|dist|build|coverage' },
    exclude: '(^|/)(node_modules|dist|build|coverage|\\.output)(/|$)',
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: { extensions: ['.ts','.tsx','.js','.jsx','.mjs','.cjs','.json'] },
    reporterOptions: { dot: { collapsePattern: 'node_modules/[^/]+' } }
  }
};
