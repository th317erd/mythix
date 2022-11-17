import { GenericObject } from '../../interfaces/common';
import { RouteCapture } from './route-capture';
import { RouteEndpoint } from './route-endpoint';

export declare type PathPart = string | RouteCapture;
export declare type RoutePart = RouteScopeBase | RouteEndpoint;

export declare interface RouteCallbackContext {
  endpoint: RouteEndpoint;
  pathParts: Array<PathPart>;
  stop: (result: any) => void;
  scope: RouteScopeBase;
}

export declare type RouteCallback = (context: RouteCallbackContext) => void;

export declare class RouteScopeBase {
  declare _parentScope: RouteScopeBase | null;
  declare _pathParts: Array<PathPart>;
  declare _routes: Map<PathPart, RoutePart>;
  declare isDynamic: boolean;

  public constructor(parentScope?: RouteScopeBase | null, pathParts?: Array<PathPart> | null);
  public getParentScope(): RouteScopeBase | null;
  public addRoute(pathPart: PathPart, scope: RoutePart): void;
  public isDynamicPathPart(pathPart: PathPart): boolean;
  public walkRoutes(callback: RouteCallback): any;
  public findFirstMatchingRoute(request: Request): { endpoint?: RouteEndpoint, params?: GenericObject, error?: string };
}
