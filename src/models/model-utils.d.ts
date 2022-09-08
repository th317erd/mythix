import { Application } from "../application";
import { ModelClass } from "./model";

export declare interface DefineModelContext {
  Parent: ModelClass;
  Types: any; // TODO: Needs mythix-orm
  connection: any; // TODO: Needs mythix-orm
  modelName: string;
  application: Application;
}

export declare function defineModel(
  modelName: string,
  // TODO: "connection" needs mythix-orm
  definer: (context: DefineModelContext) => ModelClass,
  parent?: ModelClass,
): (context: { application: Application, connection: any }) => ModelClass;
