import { GenericObject } from "../interfaces/common";
import { Application } from "../application";
import { Logger } from "../logger";

export declare interface ModelClass {
  new(data?: GenericObject, options?: GenericObject): Model;
}

export declare type ModelClasses = { [ key: string ]: ModelClass };

// TODO: Needs to extend mythix-orm model
export declare class Model {
  public static getModel(modelName?: string): ModelClass | undefined;
  public static getModels(): ModelClasses;

  public getModel(modelName?: string): ModelClass | undefined;
  public getApplication(): Application;
  public getLogger(): Logger;
  public getDBConnection(connection): any; // TODO: Needs Connection from mythix-orm
  public getConnection(connection): any; // TODO: Needs Connection from mythix-orm
}
