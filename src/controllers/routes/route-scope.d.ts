import { GenericObject } from '../../interfaces/common';
import { RouteCapture, RouteCaptureHelper, RouteCaptureOptions } from './route-capture';
import { EndpointOptions } from './route-endpoint';
import { PathPart, RouteScopeBase } from './route-scope-base';

export declare class RouteScope extends RouteScopeBase {
  public path(pathPart: PathPart, callback: (context: RouteScope) => void, options?: GenericObject): void;
  public endpoint(pathPart: PathPart, options: EndpointOptions | string): void;
  public capture(paramName: string, _helperOrOptions?: RouteCaptureHelper | GenericObject, _options?: RouteCaptureOptions): RouteCapture;
}
