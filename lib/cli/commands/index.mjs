export * from './generators/index.js';
export * from './deploy-command.js';
export * from './migrate-command.js';
export * from './routes-command.js';
export * from './serve-command.js';
export * from './shell-command.js';

import { GenerateCommand } from './generators/generate-command.js';
import { DeployCommand  } from './deploy-command.js';
import { MigrateCommand } from './migrate-command.js';
import { RoutesCommand } from './routes-command.js';
import { ServeCommand } from './serve-command.js';
import { ShellCommand } from './shell-command.js';

export const COMMANDS = {
  'generate': GenerateCommand,
  'deploy':   DeployCommand,
  'migrate':  MigrateCommand,
  'routes':   RoutesCommand,
  'serve':    ServeCommand,
  'shell':    ShellCommand,
};
