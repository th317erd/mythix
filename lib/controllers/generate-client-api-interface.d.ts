import { Application } from '../application';
import { GenericObject } from '../interfaces/common';

export declare interface GenerateClientInterfaceOptions {
  globalName?: string;
  environment?: string;
  defaultRouteOptions?: GenericObject;
  mode?: string;
  domain?: string;
  routeFilter?: ((value: any, index?: number) => boolean) | RegExp | string;
  type?: 'module' | 'commonjs';
}

export declare function generateClientAPIInterface(application: Application, options?: GenerateClientInterfaceOptions): string;
