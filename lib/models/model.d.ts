import { Application } from '../application';
import { Logger } from '../logger';
import { ConnectionBase, Model as _Model } from 'mythix-orm';

export declare class Model extends _Model {
  declare public static _getConnection: (connection?: ConnectionBase) => ConnectionBase;

  public getApplication(): Application;
  public getLogger(): Logger;
}
