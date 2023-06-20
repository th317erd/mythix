import { Types } from 'mythix-orm';
import { Model } from './model.mjs';

const ID_STRING_MAX_SIZE = 15;

export class Migration extends Model {
  static fields = {
    id: {
      type:         Types.STRING(ID_STRING_MAX_SIZE),
      allowNull:    false,
      primaryKey:   true,
      index:        true,
    },
    createdAt: {
      type:         Types.DATETIME,
      defaultValue: Types.DATETIME.Default.NOW,
      allowNull:    false,
      index:        true,
    },
    updatedAt: {
      type:         Types.DATETIME,
      defaultValue: Types.DATETIME.Default.NOW.UPDATE,
      allowNull:    false,
      index:        true,
    },
  };
}
