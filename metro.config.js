const path = require('path');

module.exports = {
  resolver: {
    extraNodeModules: {
      '@openduet/core': path.resolve(__dirname, '../core/src'),
    },
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(__dirname, '../core/node_modules'),
    ],
  },
  watchFolders: [path.resolve(__dirname, '../core/src'), path.resolve(__dirname, '../core/node_modules')],
};