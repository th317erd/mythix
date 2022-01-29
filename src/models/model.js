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

      if (value === null) {
        finalQuery[key] = { [Ops.is]: value };
      } else if (Nife.instanceOf(value, 'number', 'string', 'boolean', 'bigint')) {
        finalQuery[key] = { [Ops.eq]: value };
      } else if (Nife.instanceOf(value, 'array') && Nife.isNotEmpty(value)) {
        finalQuery[key] = { [Ops.in]: value };
      } else if (Nife.isNotEmpty(value)) {
        finalQuery[key] = value;
      }
    }

    return finalQuery;
  }

  static onModelClassCreate(Klass) {
    Klass.first = Klass.first.bind(this, Klass);
    Klass.last  = Klass.last.bind(this, Klass);

    return Klass;
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
