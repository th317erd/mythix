import { GenericObject } from '../interfaces/common';
import BaseModule from './base-module';

declare class DatabaseModule extends BaseModule {
  public getConfig(): GenericObject;
  public getDatabaseConfig(): GenericObject;
  public getTablePrefix(): string | null;
  public getConnection(): any; // TODO: Need to be a mythix-orm connection
  public connectToDatabase(databaseConfig): Promise<any>; // TODO: Needs to be Promise<Connection>

  declare public connection: any; // TODO: Needs mythix-orm connection
  declare public databaseConfig: GenericObject;
}

export = DatabaseModule;
