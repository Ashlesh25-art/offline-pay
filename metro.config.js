const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Exclude the backend folder from Metro bundler
config.resolver.blockList = [
  /offline-pay-backend\/.*/,
  /offline-pay-backend$/
];

// Also exclude from file watching for better performance
config.watchFolders = config.watchFolders || [];

module.exports = config;