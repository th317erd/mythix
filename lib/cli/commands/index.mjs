export * from './generators/index.mjs';
export * from './deploy-command.mjs';
export * from './migrate-command.mjs';
export * from './routes-command.mjs';
export * from './serve-command.mjs';
export * from './shell-command.mjs';

import { GenerateCommand } from './generators/generate-command.mjs';
import { DeployCommand  } from './deploy-command.mjs';
import { MigrateCommand } from './migrate-command.mjs';
import { RoutesCommand } from './routes-command.mjs';
import { ServeCommand } from './serve-command.mjs';
import { ShellCommand } from './shell-command.mjs';

export const COMMANDS = {
  'generate': GenerateCommand,
  'deploy':   DeployCommand,
  'migrate':  MigrateCommand,
  'routes':   RoutesCommand,
  'serve':    ServeCommand,
  'shell':    ShellCommand,
};
