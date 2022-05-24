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

  overrideMethod(name, callback) {
    let originalMethod = this[name];
    if (typeof originalMethod !== 'function')
      throw new TypeError(`Model: Error while attempting to override method "${name}: No such method found"`);

    let newMethod = callback(originalMethod.bind(this));

    Object.defineProperties(this, {
      [name]: {
        writable:     true,
        enumberable:  false,
        configurable: true,
        value:        newMethod.bind(this),
      },
    });

    return originalMethod;
  }

  overrideMethods(methodsObj) {
    const doOverrideMethod = (name, newMethod) => {
      this.overrideMethod(name, (originalMethod) => {
        return newMethod.bind(this, originalMethod);
      });
    };

    let keys = Object.keys(methodsObj);
    for (let i = 0, il = keys.length; i < il; i++) {
      let name    = keys[i];
      let method  = methodsObj[name];

      doOverrideMethod(name, method);
    }
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

  static getDefaultOrderBy() {
    return [ this.getPrimaryKeyFieldName() ];
  }

  static prepareQueryOptions(conditions, _order) {
    const Ops = Sequelize.Op;
    let options;
    let query;

    if (conditions && Nife.isNotEmpty(conditions.where)) {
      query = conditions.where;
      options = Object.assign({}, conditions);
    } else if (conditions && conditions.where !== null) {
      query = this.prepareWhereStatement(conditions);
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
        if (typeof this.getDefaultOrderBy === 'function')
          order = this.getDefaultOrderBy();
        else
          order = [ this.getPrimaryKeyFieldName() ];
      }
    }

    options.order = order;
    if (!Object.prototype.hasOwnProperty.call(options, 'distinct'))
      options.distinct = true;

    // If no "where" clause was specified, then grab everything
    if (!options.where)
      options.where = { [ this.getPrimaryKeyFieldName() ]: { [Ops.not]: null } };

    if (options.debug)
      console.log('QUERY OPTIONS: ', options);

    return options;
  }

  static where(conditions) {
    return this.prepareWhereStatement(conditions);
  }

  static async rowCount(conditions, options) {
    return await this.count(this.prepareQueryOptions(conditions, options));
  }

  static async bulkUpdate(attrs, conditions) {
    return await this.update(attrs, this.prepareQueryOptions(conditions, { distinct: false }));
  }

  static async all(conditions, order) {
    return await this.findAll(this.prepareQueryOptions(conditions, order));
  }

  static async first(conditions, order) {
    return await this.findOne(this.prepareQueryOptions(conditions, order));
  }

  static async last(conditions, _order) {
    let order = _order;
    if (!order)
      order = [ [ 'createdAt', 'DESC' ] ];

    return await this.first(conditions, order);
  }
}

module.exports = {
  Model,
};
