const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Restrict Metro to only watch the app directory, not the monorepo root
config.watchFolders = [__dirname];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

module.exports = config;
