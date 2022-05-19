'use strict';

const Nife          = require('nife');
const { Sequelize } = require('sequelize');

class Model extends Sequelize.Model {
  getApplication() {
    return this.constructor.getApplication();
  }

  getLogger() {
    let application = this.getApplication();
    return application.getLogger();
  }

  getDBConnection() {
    let application = this.getApplication();
    return application.getDBConnection();
  }

  getPrimaryKeyField() {
    return this.constructor.getPrimaryKeyField();
  }

  getPrimaryKeyFieldName() {
    return this.constructor.getPrimaryKeyFieldName();
  }

  static prepareWhereStatement(conditions) {
    if (Nife.isEmpty(conditions))
      return undefined;

    if (conditions._mythixQuery)
      return conditions;

    const Ops       = Sequelize.Op;
    let finalQuery  = {};
    let keys        = Object.keys(conditions).concat(Object.getOwnPropertySymbols(conditions));

    for (let i = 0, il = keys.length; i < il; i++) {
      let key   = keys[i];
      let value = conditions[key];

      if (value === undefined)
        continue;

      let name    = key;
      let invert  = false;

      if (typeof name === 'string' && name.charAt(0) === '!') {
        name    = name.substring(1);
        invert  = true;
      }

      if (typeof key === 'symbol') {
        finalQuery[key] = value;
      } else if (value === null) {
        finalQuery[name] = (invert) ? { [Ops.not]: value } : { [Ops.is]: value };
      } else if (Nife.instanceOf(value, 'number', 'string', 'boolean', 'bigint')) {
        finalQuery[name] = (invert) ? { [Ops.ne]: value } : { [Ops.eq]: value };
      } else if (Nife.instanceOf(value, 'array') && Nife.isNotEmpty(value)) {
        finalQuery[name] = (invert) ? { [Ops.not]: { [Ops.in]: value } } : { [Ops.in]: value };
      } else if (Nife.isNotEmpty(value)) {
        if (invert)
          throw new Error(`Model.prepareWhereStatement: Attempted to invert a custom matcher "${name}"`);

        finalQuery[name] = value;
      }
    }

    if (Nife.isEmpty(finalQuery))
      return;

    Object.defineProperties(finalQuery, {
      '_mythixQuery': {
        writable:     false,
        enumberable:  false,
        configurable: false,
        value:        true,
      },
    });

    return finalQuery;
  }

  static onModelClassFinalized(Klass) {
    Klass.getDefaultOrderBy   = Klass.getDefaultOrderBy.bind(this, Klass);
    Klass.prepareQueryOptions = Klass.prepareQueryOptions.bind(this, Klass);
    Klass.bulkUpdate          = Klass.bulkUpdate.bind(this, Klass);
    Klass.all                 = Klass.all.bind(this, Klass);
    Klass.where               = Klass.where.bind(this, Klass);
    Klass.rowCount            = Klass.rowCount.bind(this, Klass);
    Klass.first               = Klass.first.bind(this, Klass);
    Klass.last                = Klass.last.bind(this, Klass);

    return Klass;
  }

  static getDefaultOrderBy(ModelClass) {
    return [ ModelClass.getPrimaryKeyFieldName() ];
  }

  static prepareQueryOptions(ModelClass, conditions, _order) {
    const Ops = Sequelize.Op;
    let options;
    let query;

    if (conditions && Nife.isNotEmpty(conditions.where)) {
      query = conditions.where;
      options = Object.assign({}, conditions);
    } else if (conditions && conditions.where !== null) {
      query = ModelClass.prepareWhereStatement(conditions);
    }

    let order = _order;
    if (!options && Nife.instanceOf(order, 'object')) {
      options = Object.assign({}, order);
      order = options.order;
    } else if (!options) {
      options = {};
    }

    if (Nife.isNotEmpty(query))
      options.where = query;

    if (!order && options.defaultOrder !== false) {
      if (options.order) {
        order = options.order;
      } else {
        if (typeof ModelClass.getDefaultOrderBy === 'function')
          order = ModelClass.getDefaultOrderBy();
        else
          order = [ ModelClass.getPrimaryKeyFieldName() ];
      }
    }

    options.order = order;
    if (!Object.prototype.hasOwnProperty.call(options, 'distinct'))
      options.distinct = true;

    // If no "where" clause was specified, then grab everything
    if (!options.where)
      options.where = { [ModelClass.getPrimaryKeyFieldName()]: { [Ops.not]: null } };

    if (options.debug)
      console.log('QUERY OPTIONS: ', options);

    return options;
  }

  static where(ModelClass, conditions) {
    return ModelClass.prepareWhereStatement(conditions);
  }

  static async rowCount(ModelClass, conditions, options) {
    return await ModelClass.count(ModelClass.prepareQueryOptions(conditions, options));
  }

  static async bulkUpdate(ModelClass, attrs, conditions) {
    return await ModelClass.update(attrs, ModelClass.prepareQueryOptions(conditions, { distinct: false }));
  }

  static async all(ModelClass, conditions, order) {
    return await ModelClass.findAll(ModelClass.prepareQueryOptions(conditions, order));
  }

  static async first(ModelClass, conditions, order) {
    return await ModelClass.findOne(ModelClass.prepareQueryOptions(conditions, order));
  }

  static async last(ModelClass, conditions, _order) {
    let order = _order;
    if (!order)
      order = [ [ 'createdAt', 'DESC' ] ];

    return await ModelClass.first(conditions, order);
  }
}

module.exports = {
  Model,
};
