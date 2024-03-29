export declare interface LoggerWriter {
  error: (...args: Array<any>) => void;
  warn: (...args: Array<any>) => void;
  info: (...args: Array<any>) => void;
  debug: (...args: Array<any>) => void;
  log: (...args: Array<any>) => void;
}

export declare type ErrorStackFormatterMethod = (error: Error) => void;

export declare type LoggerClass = typeof Logger;

export declare interface LoggerOptions {
  level?: number;
  writer?: string | LoggerWriter | null;
  errorStackFormatter?: ErrorStackFormatterMethod;
}

export declare class Logger {
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
  declare protected _errorStackFormatter: string;

  constructor(options?: LoggerOptions);

  public getLevel(): number;
  public setLevel(level: number): void;
  public clone(extraOpts?: LoggerOptions): Logger;
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
