import { ConnectionBase } from 'mythix-orm';
import { GenericObject } from '../interfaces/common';
import { BaseModule } from './base-module';

export declare class DatabaseModule extends BaseModule {
  public getDatabaseConfig(): GenericObject;
  public getConfig(): GenericObject;
  public getTablePrefix(): string | null;
  public getConnection(): ConnectionBase;
  public connectToDatabase(databaseConfig: GenericObject): Promise<ConnectionBase>;

  declare public connection: ConnectionBase;
  declare public databaseConfig: GenericObject;
}
