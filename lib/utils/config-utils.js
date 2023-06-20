import Nife from 'nife';

function getConfigKey(CONFIG, key) {
  return key.replace(/\{([^}]+)\}/g, (m, name) => {
    if (!Object.prototype.hasOwnProperty.call(CONFIG, name))
      return new TypeError(`ENV.getConfigKey: error, attempt to expand config value "{${name}}", but no such key exists`);

    let value = CONFIG[name];
    if (!Nife.instanceOf(value, 'number', 'string', 'boolean', 'bigint'))
      throw new TypeError(`ENV.getConfigKey: error, attempt to expand config value "{${name}}", but value is wrong type: ${typeof value}`);

    return ('' + value);
  });
}

function ENV(_key, defaultValue) {
  let key   = getConfigKey(this, _key);
  let value = Nife.get(this, key);

  if (value === undefined && Object.prototype.hasOwnProperty.call(process.env, key))
    value = process.env[key];

  return (value === undefined) ? defaultValue : value;
}

export function wrapConfig(CONFIG) {
  return {
    CONFIG,
    ENV: ENV.bind(CONFIG),
  };
}
