import { DateTime } from 'luxon';
import { Model } from './model';

export declare class MigrationModel extends Model {
  declare public id: string;
  declare public createdAt: DateTime | string;
  declare public updatedAt: DateTime | string;
}
