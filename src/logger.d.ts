declare interface _LoggerWriter {
  error: (...args: Array<any>) => void;
  warn: (...args: Array<any>) => void;
  info: (...args: Array<any>) => void;
  debug: (...args: Array<any>) => void;
  log: (...args: Array<any>) => void;
}

declare type _ErrorStackFormatterMethod = (rootPath: string, error: Error) => void;

declare interface _LoggerClass {
  new(options?: _LoggerOptions): Logger;
}

declare interface _LoggerOptions {
  level?: number;
  writer?: string | _LoggerWriter | null;
  rootPath?: string;
  errorStackFormatter?: _ErrorStackFormatterMethod;
}

declare class Logger {
  public static LEVEL_ERROR: number;
  public static LEVEL_LOG: number;
  public static LEVEL_WARN: number;
  public static LEVEL_INFO: number;
  public static LEVEL_DEBUG: number;

  declare protected _level: number;
  declare protected _writer: string;
  declare protected _customWriter: string;
  declare protected _pid: string;
  declare protected _formatter: string;
  declare protected _rootPath: string;
  declare protected _errorStackFormatter: string;

  constructor(options?: _LoggerOptions);

  public getLevel(): number;
  public setLevel(level: number): void;
  public clone(extraOpts?: _LoggerOptions): Logger;
  public isErrorLevel(): boolean;
  public isLogLevel(): boolean;
  public isWarningLevel(): boolean;
  public isInfoLevel(): boolean;
  public isDebugLevel(): boolean;

  public error(...args: Array<any>): void;
  public warn(...args: Array<any>): void;
  public info(...args: Array<any>): void;
  public debug(...args: Array<any>): void;
  public log(...args: Array<any>): void;

  public stop(): Promise<any>;
}

declare namespace Logger {
  export type LoggerWriter = _LoggerWriter;
  export type ErrorStackFormatterMethod = _ErrorStackFormatterMethod;
  export type LoggerOptions = _LoggerOptions;
  export type LoggerClass = _LoggerClass;
}

export = Logger;
