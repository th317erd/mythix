import Application from '../application';
import Logger from '../logger';

export class BaseModule {
  public static getModuleName(): string;
  declare public application: Application;

  public constructor(application: Application);
  public getApplication(): Application;
  public getLogger(): Logger;
  public getConfigValue(...args: Array<any>): any;
  public async start(): void;
  public async stop(): void;
}
