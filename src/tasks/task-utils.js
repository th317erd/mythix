'use strict';

const Nife          = require('nife');
const { TaskBase }  = require('./task-base');

const SECONDS_PER_MINUTE      = 60;
const MINUTES_PER_HOUR        = 60;
const SECONDS_PER_HOUR        = (SECONDS_PER_MINUTE * MINUTES_PER_HOUR);
const HOURS_PER_DAY           = 24;
const MINUTES_PER_DAY         = (MINUTES_PER_HOUR * HOURS_PER_DAY);
const SECONDS_PER_DAY         = (MINUTES_PER_DAY * SECONDS_PER_MINUTE);
const MILLISECONDS_PER_SECOND = 1000;

class TimeHelpers {
  constructor(_days, _hours, _minutes, _seconds) {
    Object.defineProperties(this, {
      '_days': {
        writable:     true,
        enumberable:  false,
        configurable: true,
        value:        _days || 0,
      },
      '_hours': {
        writable:     true,
        enumberable:  false,
        configurable: true,
        value:        _hours || 0,
      },
      '_minutes': {
        writable:     true,
        enumberable:  false,
        configurable: true,
        value:        _minutes || 0,
      },
      '_seconds': {
        writable:     true,
        enumberable:  false,
        configurable: true,
        value:        _seconds || 0,
      },
    });

    this.days     = this.days.bind(this);
    this.hours    = this.hours.bind(this);
    this.minutes  = this.minutes.bind(this);
    this.seconds  = this.seconds.bind(this);
  }

  clone(_days, _hours, _minutes, _seconds) {
    return new TimeHelpers(_days || this._days, _hours || this._hours, _minutes || this._minutes, _seconds || this._seconds);
  }

  reset() {
    return new TimeHelpers();
  }

  days(number) {
    return this.clone(number);
  }

  hours(number) {
    return this.clone(undefined, number);
  }

  minutes(number) {
    return this.clone(undefined, undefined, number);
  }

  seconds(number) {
    return this.clone(undefined, undefined, undefined, number);
  }

  totalSeconds() {
    let totalTime = (this._days * SECONDS_PER_DAY) + (this._hours * SECONDS_PER_HOUR) + (this._minutes * SECONDS_PER_MINUTE) + this._seconds;
    return totalTime;
  }

  totalMilliseconds() {
    return Math.round(this.totalSeconds() * MILLISECONDS_PER_SECOND);
  }
}

function defineTask(taskName, definer, _parent) {
  let parentKlass = _parent || TaskBase;

  return function({ application, connection, dbConfig }) {
    let time = new TimeHelpers();

    let Klass = definer({
      Parent: parentKlass,
      application,
      connection,
      dbConfig,
      taskName,
      time,
    });

    if (typeof Klass.prototype.execute !== 'function')
      throw new Error(`Error while defining task ${taskName}: "execute" method is required`);

    Klass.taskName = taskName;

    Klass._frequency = Klass.frequency;
    if (Klass._frequency instanceof TimeHelpers)
      Klass._frequency = Klass._frequency.totalSeconds();

    Klass._startDelay = Klass.startDelay;
    if (Klass._startDelay instanceof TimeHelpers)
      Klass._startDelay = Klass._startDelay.totalSeconds();

    if (Nife.instanceOf(Klass._frequency, 'number') && (Klass._frequency <= 0 || !isFinite(Klass._frequency)))
      throw new Error(`Error while defining task ${taskName}: "static frequency" must be a valid number of seconds`);
    else if (Klass._frequency && !Nife.instanceOf(Klass._frequency, 'number'))
      throw new Error(`Error while defining task ${taskName}: "static frequency" must be a valid number of seconds`);

    if (Nife.instanceOf(Klass._startDelay, 'number') && (Klass._startDelay < 0 || !isFinite(Klass._startDelay)))
      throw new Error(`Error while defining task ${taskName}: "static startDelay" must be a valid number of seconds`);
    else if (Klass._startDelay && !Nife.instanceOf(Klass._startDelay, 'number'))
      throw new Error(`Error while defining task ${taskName}: "static startDelay" must be a valid number of seconds`);

    if (typeof Klass.onTaskClassCreate === 'function')
      Klass = Klass.onTaskClassCreate(Klass);

    return { [taskName]: Klass };
  };
}

module.exports = defineTask;
