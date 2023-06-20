import MythixORM from 'mythix-orm';

export class Model extends MythixORM.Model {
  getApplication() {
    return this.constructor.getApplication();
  }

  getLogger() {
    let application = this.getApplication();
    return application.getLogger();
  }

  static _getConnection(_connection) {
    let connection = super._getConnection(_connection);
    if (connection)
      return connection;

    return this.getApplication().getConnection();
  }
}
