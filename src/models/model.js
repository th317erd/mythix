const Nife          = require('nife');
const { Sequelize } = require('sequelize');

class Model extends Sequelize.Model {
  getApplication() {
    return this.constructor.getApplication();
  }

  getLogger() {
    var application = this.getApplication();
    return application.getLogger();
  }

  getDBConnection() {
    var application = this.getApplication();
    return application.getDBConnection();
  }

  getPrimaryKeyField() {
    return this.constructor.getPrimaryKeyField();
  }

  getPrimaryKeyFieldName() {
    return this.constructor.getPrimaryKeyFieldName();
  }

  static prepareWhereStatement(conditions) {
    if (Nife.isEmpty(conditions)) {
      return undefined;
    }

    if (conditions._mythixQuery)
      return conditions;

    const Ops       = Sequelize.Op;
    var finalQuery  = {};
    var keys        = Object.keys(conditions).concat(Object.getOwnPropertySymbols(conditions));

    for (var i = 0, il = keys.length; i < il; i++) {
      var key   = keys[i];
      var value = conditions[key];

      if (value === undefined)
        continue;

      var name    = key;
      var invert  = false;

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
    Klass.bulkUpdate           = Klass.bulkUpdate.bind(this, Klass);
    Klass.all                 = Klass.all.bind(this, Klass);
    Klass.where               = Klass.where.bind(this, Klass);
    Klass.rowCount            = Klass.rowCount.bind(this, Klass);
    Klass.first               = Klass.first.bind(this, Klass);
    Klass.last                = Klass.last.bind(this, Klass);

    return Klass;
  }

  static getDefaultOrderBy(Model) {
    return [ Model.getPrimaryKeyFieldName() ];
  }

  static prepareQueryOptions(Model, conditions, _order) {
    const Ops = Sequelize.Op;
    var options;
    var query;

    if (conditions && Nife.isNotEmpty(conditions.where)) {
      query = conditions.where;
      options = Object.assign({}, conditions);
    } else if (conditions) {
      query = Model.prepareWhereStatement(conditions);
    }

    var order = _order;
    if (!options && Nife.instanceOf(order, 'object')) {
      options = Object.assign({}, order);
      order = undefined;
    } else if (!options) {
      options = {};
    }

    if (Nife.isNotEmpty(query))
      options.where = query;

    if (!order && options.defaultOrder !== false) {
      if (options.order) {
        order = options.order;
      } else {
        if (typeof Model.getDefaultOrderBy === 'function')
          order = Model.getDefaultOrderBy();
        else
          order = [ Model.getPrimaryKeyFieldName() ];
      }
    }

    options.order = order;
    if (!options.hasOwnProperty('distinct'))
      options.distinct = true;

    // If no "where" clause was specified, then grab everything
    if (!options.where)
      options.where = { [Model.getPrimaryKeyFieldName()]: { [Ops.not]: null } };

    if (options.debug)
      console.log('QUERY OPTIONS: ', options);

    return options;
  }

  static where(Model, conditions) {
    return Model.prepareWhereStatement(conditions);
  }

  static async rowCount(Model, conditions, options) {
    return await Model.count(Model.prepareQueryOptions(conditions, options));
  }

  static async bulkUpdate(Model, attrs, conditions) {
    return await Model.update(attrs, Model.prepareQueryOptions(conditions, { distinct: false }));
  }

  static async all(Model, conditions, order) {
    return await Model.findAll(Model.prepareQueryOptions(conditions, order));
  }

  static async first(Model, conditions, order) {
    return await Model.findOne(Model.prepareQueryOptions(conditions, order));
  }

  static async last(Model, conditions, _order) {
    var order = _order;
    if (!order)
      order = [ 'createdAt', 'DESC' ];

    return await Model.first(conditions, order);
  }
}

module.exports = {
  Model,
};
