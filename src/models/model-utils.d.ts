import { Application } from "../application";
import { ModelClass } from "./model";

export declare interface DefineModelContext<T = ModelClass> {
  Parent: T;
  Types: any; // TODO: Needs mythix-orm
  connection: any; // TODO: Needs mythix-orm
  modelName: string;
  application: Application;
}

export declare function defineModel<T = ModelClass>(
  modelName: string,
  // TODO: "connection" needs mythix-orm
  definer: (context: DefineModelContext<T>) => T,
  parent?: T,
): (context: { application: Application, connection: any }) => T;
