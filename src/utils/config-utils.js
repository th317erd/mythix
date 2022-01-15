function getConfigKey(CONFIG, key) {
  return key.replace(/\{([^\}]+)\}/g, (m, name) => {
    if (!CONFIG.hasOwnProperty(name))
      return new TypeError(`ENV.getConfigKey: error, attempt to expand config value "{${name}}", but no such key exists`);

    var value = CONFIG[name];
    if (!Nife.instanceOf(value, 'number', 'string', 'boolean', 'bigint'))
      throw new TypeError(`ENV.getConfigKey: error, attempt to expand config value "{${name}}", but value is wrong type: ${typeof value}`);

    return ('' + value);
  });
}

function ENV(_key, defaultValue) {
  var key   = getConfigKey(this, _key);
  var value = Nife.get(this, key);

  if (value === undefined && process.env.hasOwnProperty(key))
    value = process.env[key];

  return (value === undefined) ? defaultValue : value;
}

function wrapConfig(CONFIG) {
  return {
    CONFIG,
    ENV: ENV.bind(CONFIG),
  };
}

module.exports = {
  wrapConfig,
};
