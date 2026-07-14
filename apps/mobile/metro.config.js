const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// Find the monorepo root
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [workspaceRoot];

// 2. Let Metro know which directories to search for modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 3. Force Metro to resolve symbolicated modules from the project's node_modules
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
