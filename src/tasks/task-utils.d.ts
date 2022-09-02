import Application from "../application";
import { GenericObject } from "../interfaces/common";
import { TaskClass } from "./task-base";

declare class _TimeHelpers {
  constructor(days?: number, hours?: number, minutes?: number, seconds?: number);
  clone(days?: number, hours?: number, minutes?: number, seconds?: number): _TimeHelpers;
  reset(): _TimeHelpers;
  days(days: number): _TimeHelpers;
  hours(hours: number): _TimeHelpers;
  minutes(minutes: number): _TimeHelpers;
  seconds(seconds: number): _TimeHelpers;
  totalSeconds(): number;
  totalMilliseconds(): number;

  declare public _days: number;
  declare public _hours: number;
  declare public _minutes: number;
  declare public _seconds: number;
}

declare interface _DefineTaskContext {
  Parent: TaskClass;
  application: Application;
  connection: any; // TODO: Needs mythix-orm Connection
  dbConfig: GenericObject;
  taskName: string;
  time: _TimeHelpers;
}

declare function defineTask(
  taskName: string,
  definer: (context: _DefineTaskContext) => TaskClass,
  parent?: TaskClass
): Function;

declare namespace defineTask {
  export type TimeHelpers = _TimeHelpers;
  export type DefineTaskContext = _DefineTaskContext;
}

export = defineTask;
