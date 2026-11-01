const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.watchFolders = [__dirname];
config.useWatchman = false;

config.resolver.blockList = [
  /\/\.expo\/.*/,
  /\/android\/.*\/build\/.*/,
  /\/node_modules\/.*\/android\/.*/,
  /\/node_modules\/.*\/lib\/typescript\/.*/,
  /\/node_modules\/fb-dotslash\/.*/,
  /\/node_modules\/.*\/bin\/.*/,
  /\/node_modules\/@react-native\/debugger-frontend\/.*/,
];

module.exports = config;
