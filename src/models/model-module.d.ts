import { BaseModule } from "../modules/base-module";
import { ModelClass, ModelClasses } from "./model";

export declare class ModelModule extends BaseModule {
  getModelFilePaths(modelsPath: string): Array<string>;
  loadModels(modelsPath: string): ModelClasses;
  getModel(modelName?: string): ModelClass | undefined;
  getModels(): ModelClasses;
}
