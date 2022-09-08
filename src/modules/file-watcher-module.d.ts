import { GenericObject } from '../interfaces/common';
import { BaseModule } from './base-module';

export declare class FileWatcherModule extends BaseModule {
  public getMonitoredPaths(options?: GenericObject): Array<string>;
  public isWatchedFile(monitoredPaths: Array<string>, filePath: string): boolean;
  public getFileScope(options: GenericObject, filePath: string): string;
  public autoReload(enable?: boolean, shuttingDown?: boolean): Promise<void>;
  public watchedFilesChanged(files: GenericObject): Promise<void>;

  declare public fileWatcher: any;
  declare public watchedPathsCache: Array<string>;
}
