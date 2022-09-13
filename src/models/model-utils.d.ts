import { ConnectionBase, Types } from 'mythix-orm';
import { Application } from '../application';

export declare interface DefineModelContext<T> {
  Parent: T;
  Types: typeof Types;
  connection: ConnectionBase;
  modelName: string;
  application: Application;
}

export declare function registerModel<T>(
  Model: T,
): (context: { application: Application, connection: ConnectionBase }) => T;

export declare function defineModel<T>(
  modelName: string,
  definer: (context: DefineModelContext<T>) => T,
  parent?: T,
): (context: { application: Application, connection: ConnectionBase }) => T;
