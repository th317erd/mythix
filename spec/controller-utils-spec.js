const ControllerUtils = require('../src/controllers/controller-utils');

describe('controller-utils', function() {
  describe('buildAcceptMatcher', function() {
    it('should be able to create a content-type matcher', function() {
      var matcher = ControllerUtils.buildAcceptMatcher('*');
      expect(matcher.regexp.toString()).toBe('/.*/i');
      expect(matcher('application/json')).toBe(true);
      expect(matcher('anything')).toBe(true);
      expect(matcher()).toBe(true);

      var matcher = ControllerUtils.buildAcceptMatcher('application/json');
      expect(matcher.regexp.toString()).toBe('/(application\\/json)/i');
      expect(matcher('application/json')).toBe(true);
      expect(matcher('application/json; charset=UTF-8')).toBe(true);
      expect(matcher('text/plain')).toBe(false);

      var matcher = ControllerUtils.buildAcceptMatcher(/^(application\/json|text\/plain)$/i);
      expect(matcher.regexp).toBe(undefined);
      expect(matcher('application/json')).toBe(true);
      expect(matcher('application/json; charset=UTF-8')).toBe(false);
      expect(matcher('text/plain')).toBe(true);
      expect(matcher('text/plain;')).toBe(false);
    });
  });

  describe('buildRouteMatcher', function() {
    it('should be able to build a parser from a route name', function() {
      var matchFunc = ControllerUtils.buildRouteMatcher('person<id?:integer = 0>_stuff');
      expect(matchFunc('person120_stuff')).toEqual({ id: 120 });
      expect(matchFunc('person_stuff')).toEqual({});

      var matchFunc = ControllerUtils.buildRouteMatcher('objects/<id>');
      expect(matchFunc('objects')).toBe(undefined);
      expect(matchFunc('objects/')).toBe(undefined);
      expect(matchFunc('objects/1')).toEqual({ id: 1 });

      var matchFunc = ControllerUtils.buildRouteMatcher('objects/<id?>');
      expect(matchFunc('objects')).toEqual({});
      expect(matchFunc('objects/')).toEqual({});
      expect(matchFunc('objects/1')).toEqual({ id: 1 });

      var matchFunc = ControllerUtils.buildRouteMatcher('values/<truthy:boolean>');
      expect(matchFunc('values')).toBe(undefined);
      expect(matchFunc('values/')).toBe(undefined);
      expect(matchFunc('values/1')).toBe(undefined);
      expect(matchFunc('values/derp')).toBe(undefined);
      expect(matchFunc('values/true')).toEqual({  truthy: true });
      expect(matchFunc('values/True')).toEqual({  truthy: true });
      expect(matchFunc('values/TRUE')).toEqual({  truthy: true });
      expect(matchFunc('values/false')).toEqual({ truthy: false });
      expect(matchFunc('values/False')).toEqual({ truthy: false });
      expect(matchFunc('values/FALSE')).toEqual({ truthy: false });

      var matchFunc = ControllerUtils.buildRouteMatcher('values/<str:magic>', { magic: (part) => `MAGIC:${part}!!!`});
      expect(matchFunc('values')).toBe(undefined);
      expect(matchFunc('values/')).toBe(undefined);
      expect(matchFunc('values/1')).toEqual({ str: 'MAGIC:1!!!' });
      expect(matchFunc('values/derp')).toEqual({ str: 'MAGIC:derp!!!' });
    });
  });

  describe('buildRoutes', function() {
    fit('should be able to compile routes', function() {
      var allRoutes = ControllerUtils.buildRoutes({
        'api': {
          'v1': {
            'test': {
              methods: [ 'GET', 'POST' ],
              accept: 'application/json',
              controller: 'Something.test',
              children: [
                {
                  priority:   10,
                  methods:    'GET',
                  controller: 'Something.children.get',
                },
                {
                  priority:   11,
                  methods:    'POST',
                  controller: 'Something.children.post',
                },
                {
                  'do-something/<id:int>': {
                    priority:   10,
                    methods:    'GET',
                    controller: 'Something.children.get.doSomething',
                  }
                }
              ],
            },
            'test2': {
              priority: 0,
              methods: [ 'POST', '*' ],
              controller: 'Something.test2',
            },
          },
        },
      });

      console.log('ALL ROUTES: ', allRoutes);
    });
  });
});
