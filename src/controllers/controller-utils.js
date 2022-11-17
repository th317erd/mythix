'use strict';

const { ControllerBase } = require('./controller-base');

function defineController(controllerName, definer, _parent) {
  let parentKlass = _parent || ControllerBase;

  return function({ application, server }) {
    const Klass = definer({
      Parent: parentKlass,
      application,
      server,
      controllerName,
    });

    Klass.getControllerName = () => controllerName;

    return { [controllerName]: Klass };
  };
}

module.exports = {
  defineController,
};
