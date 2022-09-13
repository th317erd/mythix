import { Moment } from 'moment';
import { Model } from './model';

export declare class MigrationModel extends Model {
  declare public id: string;
  declare public createdAt: Moment | string;
  declare public updatedAt: Moment | string;
}
