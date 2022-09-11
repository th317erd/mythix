import { ConnectionBase } from "mythix-orm";
import { Application } from "../application";
import { GenericObject } from "../interfaces/common";
import { TaskClass } from "./task-base";

export declare class TimeHelpers {
  constructor(days?: number, hours?: number, minutes?: number, seconds?: number);
  clone(days?: number, hours?: number, minutes?: number, seconds?: number): TimeHelpers;
  reset(): TimeHelpers;
  days(days: number): TimeHelpers;
  hours(hours: number): TimeHelpers;
  minutes(minutes: number): TimeHelpers;
  seconds(seconds: number): TimeHelpers;
  totalSeconds(): number;
  totalMilliseconds(): number;

  declare public _days: number;
  declare public _hours: number;
  declare public _minutes: number;
  declare public _seconds: number;
}

export declare type TimeHelpersClass = typeof TimeHelpers;

export declare interface DefineTaskContext {
  Parent: TaskClass;
  application: Application;
  connection: ConnectionBase;
  dbConfig: GenericObject;
  taskName: string;
  time: TimeHelpers;
}

export declare function defineTask(
  taskName: string,
  definer: (context: DefineTaskContext) => TaskClass,
  parent?: TaskClass,
): (context: {
  application: Application,
  connection: ConnectionBase,
  dbConfig: GenericObject,
}) => TaskClass;

export declare namespace defineTask {
  const TimeHelpers: TimeHelpersClass;
}
