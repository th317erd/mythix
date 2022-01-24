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

  getPrimaryKeyField() {
    return this.constructor.getPrimaryKeyField();
  }

  getPrimaryKeyFieldName() {
    return this.constructor.getPrimaryKeyFieldName();
  }

  static prepareWhereStatement(conditions) {
    const Ops       = Sequelize.Op;
    var finalQuery  = {};
    var keys        = Object.keys(conditions);

    for (var i = 0, il = keys.length; i < il; i++) {
      var key   = keys[i];
      var value = conditions[key];

      if (Nife.instanceOf(value, 'number', 'string', 'boolean', 'bigint')) {
        finalQuery[key] = { [Ops.eq]: value };
      } else {
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
    var query = Model.prepareWhereStatement(conditions);
    if (Nife.isEmpty(query))
      return null;

    var order = _order;
    if (!order)
      order = [ Model.getPrimaryKeyFieldName() ];

    return await Model.findOne({
      where: query,
      order,
    });
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
