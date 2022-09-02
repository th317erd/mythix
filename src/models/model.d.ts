import Application from "../application";
import { GenericObject } from "../interfaces/common";
import Logger from "../logger";

declare interface _ModelClass {
  new(data?: GenericObject, options?: GenericObject): Model;
}

declare type _ModelClasses = { [key: string]: _ModelClass };

// TODO: Needs to extend mythix-orm model
declare class Model {
  public static getModel(modelName?: string): _ModelClass | undefined;
  public static getModels(): _ModelClasses;

  public getModel(modelName?: string): _ModelClass | undefined;
  public getApplication(): Application;
  public getLogger(): Logger;
  public getDBConnection(connection): any; // TODO: Needs Connection from mythix-orm
  public getConnection(connection): any; // TODO: Needs Connection from mythix-orm
}

declare namespace Model {
  export type ModelClass = _ModelClass;
  export type ModelClasses = _ModelClasses;
}

export = Model;
