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
    if (Nife.isEmpty(conditions))
      return undefined;

    const Ops       = Sequelize.Op;
    var finalQuery  = {};
    var keys        = Object.keys(conditions);

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
          throw new Error(`Model.prepareWhereStatement: Attempted to invert (not query) a custom matcher "${name}"`);

        finalQuery[name] = value;
      }
    }

    if (Nife.isEmpty(finalQuery))
      return;

    return finalQuery;
  }

  static onModelClassCreate(Klass) {
    Klass.where     = Klass.where.bind(this, Klass);
    Klass.rowCount  = Klass.rowCount.bind(this, Klass);
    Klass.first     = Klass.first.bind(this, Klass);
    Klass.last      = Klass.last.bind(this, Klass);

    return Klass;
  }

  static where(Model, conditions) {
    return Model.prepareWhereStatement(conditions);
  }

  static async rowCount(Model, conditions) {
    var query = Model.prepareWhereStatement(conditions);
    return await Model.count({
      where:    query,
      distinct: true,
    });
  }

  static async first(Model, conditions, _order) {
    var options = {};
    var query   = Model.prepareWhereStatement(conditions);

    if (Nife.isNotEmpty(query))
      options.where = query;

    var order = _order;
    if (!order)
      order = [ Model.getPrimaryKeyFieldName() ];

    options.order = order;

    return await Model.findOne(options);
  }

  static async last(Model, conditions, _order) {
    var order = _order;
    if (!order)
      order = [ Model.getPrimaryKeyFieldName(), 'DESC' ];

    return await Model.first(conditions, order);
  }
}

module.exports = {
  Model,
};
