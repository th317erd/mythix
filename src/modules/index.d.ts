import * as _BaseModule from './base-module';
import { default as _DatabaseModule } from './database-module';
import { default as _FileWatcherModule } from './file-watcher-module';

declare module 'Modules' {
  export import BaseModule = _BaseModule;
  export type DatabaseModule = _DatabaseModule;
  export type FileWatcherModule = _FileWatcherModule;
}
