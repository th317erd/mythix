import Nife  from 'nife';

export class RouteCapture {
  constructor(parentScope, paramName, _helperOrOptions, _options) {
    let helper;
    let options;

    if (!Nife.instanceOf(paramName, 'string'))
      throw new TypeError('RouteCapture::constructor: "paramName" is required to be a string.');

    if (typeof _helperOrOptions === 'function' || _helperOrOptions instanceof RegExp) {
      helper = _helperOrOptions;
      options = _options || {};
    } else {
      options = _helperOrOptions || {};
    }

    Object.defineProperties(this, {
      '_parentScope': {
        writable:     false,
        enumerable:   false,
        configurable: false,
        value:        parentScope || null,
      },
      '_paramName': {
        writable:     false,
        enumerable:   false,
        configurable: false,
        value:        paramName,
      },
      '_helper': {
        writable:     false,
        enumerable:   false,
        configurable: false,
        value:        helper || null,
      },
      '_options': {
        writable:     false,
        enumerable:   false,
        configurable: false,
        value:        options,
      },
    });
  }

  getParentScope = () => {
    return this._parentScope;
  };

  getName() {
    return this._paramName;
  }

  isOptional() {
    return !!this._options.optional;
  }

  clone(newOptions) {
    let options = Object.assign({}, this._options, newOptions || {});

    if (this._helper)
      return new this.constructor(this._parentScope, this._paramName, this._helper, options);
    else
      return new this.constructor(this._parentScope, this._paramName, options);
  }

  matches(context) {
    let helper = this._helper;
    if (typeof helper === 'function') {
      return helper(context);
    } else if (helper instanceof RegExp) {
      let result = context.value.match(helper);
      if (!result)
        return;

      return (result && result.groups) ? result.groups : result[0];
    } else {
      if (!this.isOptional() && Nife.isEmpty(context.value))
        return;

      let options = this._options || {};
      let type    = options.type || 'string';
      return Nife.coerceValue(context.value, type);
    }
  }

  toString() {
    let paramName = this.getName();
    let optional  = this.isOptional();

    return `<<${paramName}${(optional) ? '?' : ''}>>`;
  }
}
