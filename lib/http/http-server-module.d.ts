import { ModuleBase } from '../modules/module-base';
import { GenericObject } from '../interfaces/common';
import { HTTPServer } from './http-server';

export declare class HTTPServerModule extends ModuleBase {
  public getHTTPServer(): HTTPServer | null;
  public getHTTPServerConfig(): GenericObject;
  public createHTTPServer(httpServerConfig: GenericObject): HTTPServer;
}
