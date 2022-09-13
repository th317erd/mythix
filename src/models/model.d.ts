import { Application } from '../application';
import { Logger } from '../logger';
import { ConnectionBase, Model as _Model, ModelClass } from 'mythix-orm';
import { DefineModelContext } from './model-utils';

export declare class Model extends _Model {
  declare public static getTableName: () => string;
  declare public static getModelName: () => string;
  declare public static getApplication: () => Application;
  declare public static getLogger: () => Logger;
  declare public static _getConnection: (connection?: ConnectionBase) => ConnectionBase;
  declare public static onModelClassFinalized?: (Model: ModelClass, definerArgs: DefineModelContext<Model>) => ModelClass;

  public getApplication(): Application;
  public getLogger(): Logger;
  public getDBConnection(connection): ConnectionBase;
}
