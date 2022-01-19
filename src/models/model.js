const { Sequelize } = require('sequelize');

class Model extends Sequelize.Model {
  getApplication() {
    return this.constructor.getApplication();
  }

  getLogger() {
    var application = this.getApplication();
    return application.getLogger();
  }
}

module.exports = {
  Model,
};
