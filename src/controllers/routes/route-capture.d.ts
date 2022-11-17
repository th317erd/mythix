import { GenericObject } from '../../interfaces/common';
import { RouteScopeBase } from './route-scope-base';

export declare interface RouteCaptureOptions {
  type?: string;
  optional?: boolean;
}

export declare interface RouteCaptureHelperContext {
  value: string;
  request: Request;
  method: string;
  path: string;
  contentType: string | undefined;
  params: GenericObject;
}

export declare type RouteCaptureHelper = ((context: RouteCaptureHelperContext) => any) | RegExp;

export declare class RouteCapture {
  declare _parentScope: RouteScopeBase;
  declare _paramName: string;
  declare _helper: RouteCaptureHelper | null;
  declare _options: RouteCaptureOptions;

  public constructor(parentScope: RouteScopeBase, paramName: string, _helperOrOptions?: RouteCaptureHelper | GenericObject, _options?: RouteCaptureOptions);
  public getParentScope(): RouteScopeBase;
  public getName(): string;
  public isOptional(): boolean;
  public clone(newOptions?: RouteCaptureOptions): RouteCapture;
  public matches(context: RouteCaptureHelperContext): any;
}
