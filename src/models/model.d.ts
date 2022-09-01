import Application from "../application";
import Logger from "../logger";

declare type _Models = { [key: string]: Model };

// TODO: Needs to extend mythix-orm model
declare class Model {
  public static getModel(modelName?: string): Model | undefined;
  public static getModels(): _Models;

  public getModel(modelName?: string): Model | undefined;
  public getApplication(): Application;
  public getLogger(): Logger;
  public getDBConnection(connection): any; // TODO: Needs Connection from mythix-orm
  public getConnection(connection): any; // TODO: Needs Connection from mythix-orm
}

declare namespace Model {
  export type Models = _Models;
}

export = Model;
