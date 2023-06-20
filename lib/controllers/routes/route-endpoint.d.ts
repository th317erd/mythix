import { GenericObject } from '../../interfaces/common';
import { RouteScopeBase } from './route-scope-base';

export declare type EndpointMethods = 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | '*';

export declare interface EndpointCORsOptions {
  allowOrigin: string;
  allowMethods?: string | Array<string>;
  allowHeaders?: string | Array<string>;
  maxAge?: number;
}

export declare interface EndpointOptions {
  name?: string;
  methods?: Array<EndpointMethods> | EndpointMethods;
  contentType?: Array<string | RegExp> | string | RegExp;
  controller: string;
  path?: string;
  help?: GenericObject;
  queryParams?: GenericObject;
  middleware?: Array<Function>;
  cors?: boolean | EndpointCORsOptions;
  [key: string | symbol]: any;
}

export declare class RouteEndpoint implements EndpointOptions {
  declare _parentScope: RouteScopeBase;
  declare isDynamic: boolean;
  declare controller: string;
  declare methods: Array<EndpointMethods>;

  public constructor(parentScope: RouteScopeBase, attributes: EndpointOptions);
  public getParentScope(): RouteScopeBase;
}
