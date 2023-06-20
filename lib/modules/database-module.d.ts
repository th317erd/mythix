import { ConnectionBase } from 'mythix-orm';
import { GenericObject } from '../interfaces/common';
import { ModuleBase } from './module-base';

export declare class DatabaseModule extends ModuleBase {
  public getDatabaseConfig(): GenericObject;
  public getConfig(): GenericObject;
  public getTablePrefix(): string | null;
  public getConnection(): ConnectionBase;
  public connectToDatabase(databaseConfig: GenericObject): Promise<ConnectionBase>;

  declare public connection: ConnectionBase;
  declare public databaseConfig: GenericObject;
}
