const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.watchFolders = [__dirname];

config.resolver.blockList = [
  /node_modules\/.*\/android\/.*/,
  /node_modules\/.*\/android\/build\/.*/,
  /node_modules\/fb-dotslash\/.*/,
  /node_modules\/.*\/bin\/(macos|linux|win32)\/.*/,
];

module.exports = config;
