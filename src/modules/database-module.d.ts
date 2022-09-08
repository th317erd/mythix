import { GenericObject } from '../interfaces/common';
import { BaseModule } from './base-module';

export declare class DatabaseModule extends BaseModule {
  public getDatabaseConfig(): GenericObject;
  public getConfig(): GenericObject;
  public getTablePrefix(): string | null;
  public getConnection(): any; // TODO: Need to be a mythix-orm connection
  public connectToDatabase(databaseConfig: GenericObject): Promise<any>; // TODO: Needs to be Promise<Connection>

  declare public connection: any; // TODO: Needs mythix-orm connection
  declare public databaseConfig: GenericObject;
}
