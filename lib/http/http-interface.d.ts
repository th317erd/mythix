import { GenericObject } from '../interfaces/common';

export declare class HTTPInterface {
  declare public defaultURL: string | null;
  declare public defaultHeaders: GenericObject;

  public constructor();
  public getDefaultURL(): string;
  public setDefaultURL(url: string): void;
  public getDefaultHeader(headerName: string): string | undefined;
  public getDefaultHeaders(): GenericObject;
  public setDefaultHeader(headerName: string, value: string): void;
  public setDefaultHeaders(headers: { [ key: string ]: string }): void;
  public keysToLowerCase(obj: { [ key: string ]: string }): { [ key: string ]: string };
  public makeRequest(requestOptions: GenericObject): Promise<any>;
  public getRequestOptions(url: string, options: GenericObject, method: string): GenericObject;
  public request(url: string, options: GenericObject): Promise<any>;
  public getRequest(url: string, options: GenericObject): Promise<any>;
  public postRequest(url: string, options: GenericObject): Promise<any>;
  public patchRequest(url: string, options: GenericObject): Promise<any>;
  public putRequest(url: string, options: GenericObject): Promise<any>;
  public deleteRequest(url: string, options: GenericObject): Promise<any>;
  public headRequest(url: string, options: GenericObject): Promise<any>;
  public optionsRequest(url: string, options: GenericObject): Promise<any>;
}
