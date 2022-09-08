import { BaseModule } from "../modules/base-module";
import { GenericObject } from "../interfaces/common";
import { HTTPServer } from "./http-server";

export declare class HTTPServerModule extends BaseModule {
  public getHTTPServer(): HTTPServer | null;
  public getHTTPServerConfig(): GenericObject;
  public createHTTPServer(httpServerConfig: GenericObject): HTTPServer;
}
