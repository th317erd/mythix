import { ModelClass, Models } from "mythix-orm";
import { BaseModule } from "../modules/base-module";

export declare class ModelModule extends BaseModule {
  getModelFilePaths(modelsPath: string): Array<string>;
  loadModels(modelsPath: string): Models;
  getModel(modelName?: string): ModelClass | undefined;
  getModels(): Models;
}
