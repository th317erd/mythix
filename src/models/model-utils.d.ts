import Application from "../application";
import { ModelClass } from "./model";

declare interface _DefineModelContext {
  Parent: ModelClass;
  Types: any; // TODO: Needs mythix-orm
  connection: any; // TODO: Needs mythix-orm
  modelName: string;
  application: Application;
}

declare function defineModel(
  modelName: string,
  definer: (context: _DefineModelContext) => ModelClass,
  parent?: ModelClass,
);

declare namespace defineModel {
  export type DefineModelContext = _DefineModelContext;
}

export = defineModel;
