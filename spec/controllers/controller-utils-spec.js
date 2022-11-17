'use strict';

/* global describe, it, expect */

const ControllerUtils = require('../../src/controllers/controller-utils');

describe('controller-utils', function() {
  describe('buildMethodMatcher', function() {
    it('should be able to create a method matcher', function() {
      let matchFunc = ControllerUtils.buildMethodMatcher('*');
      expect(matchFunc(null)).toBe(true);
      expect(matchFunc('')).toBe(true);
      expect(matchFunc('GET')).toBe(true);
      expect(matchFunc('get')).toBe(true);
      expect(matchFunc('Post')).toBe(true);

      matchFunc = ControllerUtils.buildMethodMatcher([ 'GET', '*' ]);
      expect(matchFunc('')).toBe(true);
      expect(matchFunc('GET')).toBe(true);
      expect(matchFunc('get')).toBe(true);
      expect(matchFunc('Post')).toBe(true);

      matchFunc = ControllerUtils.buildMethodMatcher('GET');
      expect(matchFunc('GET')).toBe(true);
      expect(matchFunc('get')).toBe(true);
      expect(matchFunc('GETs')).toBe(false);
      expect(matchFunc('post')).toBe(false);

      matchFunc = ControllerUtils.buildMethodMatcher([ 'get', 'POST' ]);
      expect(matchFunc('GET')).toBe(true);
      expect(matchFunc('get')).toBe(true);
      expect(matchFunc('POST')).toBe(true);
      expect(matchFunc('head')).toBe(false);

      matchFunc = ControllerUtils.buildMethodMatcher(/(get|post)/i);
      expect(matchFunc('GET')).toBe(true);
      expect(matchFunc('get')).toBe(true);
      expect(matchFunc('gets')).toBe(true);
      expect(matchFunc('POST')).toBe(true);
      expect(matchFunc('POSTs')).toBe(true);
      expect(matchFunc('head')).toBe(false);
    });
  });

  describe('buildContentTypeMatcher', function() {
    it('should be able to create a content-type matcher', function() {
      let matcher = ControllerUtils.buildContentTypeMatcher('*');
      expect(matcher.regexp.toString()).toBe('/.*/i');
      expect(matcher('application/json')).toBe(true);
      expect(matcher('anything')).toBe(true);
      expect(matcher()).toBe(true);

      matcher = ControllerUtils.buildContentTypeMatcher('application/json');
      expect(matcher.regexp.toString()).toBe('/(application\\/json)/i');
      expect(matcher('application/json')).toBe(true);
      expect(matcher('application/json; charset=UTF-8')).toBe(true);
      expect(matcher('text/plain')).toBe(false);

      matcher = ControllerUtils.buildContentTypeMatcher(/^(application\/json|text\/plain)$/i);
      expect(matcher.regexp.toString()).toBe('/^(application\\/json|text\\/plain)$/i');
      expect(matcher('application/json')).toBe(true);
      expect(matcher('application/json; charset=UTF-8')).toBe(false);
      expect(matcher('text/plain')).toBe(true);
      expect(matcher('text/plain;')).toBe(false);
    });
  });

  describe('buildPathMatcher', function() {
    it('should be able to build a parser from a route name', function() {
      let matchFunc = ControllerUtils.buildPathMatcher('person<id?:integer = 0>_stuff');
      expect(matchFunc('person120_stuff')).toEqual({ id: 120 });
      expect(matchFunc('person_stuff')).toEqual({});

      matchFunc = ControllerUtils.buildPathMatcher('objects/<id>');
      expect(matchFunc('objects')).toBe(undefined);
      expect(matchFunc('objects/')).toBe(undefined);
      expect(matchFunc('objects/1')).toEqual({ id: 1 });

      matchFunc = ControllerUtils.buildPathMatcher('objects/<id?>');
      expect(matchFunc('objects')).toEqual({});
      expect(matchFunc('objects/')).toEqual({});
      expect(matchFunc('objects/1')).toEqual({ id: 1 });

      matchFunc = ControllerUtils.buildPathMatcher('values/<truthy:boolean>');
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

      matchFunc = ControllerUtils.buildPathMatcher('values/<str:magic>', { magic: (part) => `MAGIC:${part}!!!`});
      expect(matchFunc('values')).toBe(undefined);
      expect(matchFunc('values/')).toBe(undefined);
      expect(matchFunc('values/1')).toEqual({ str: 'MAGIC:1!!!' });
      expect(matchFunc('values/derp')).toEqual({ str: 'MAGIC:derp!!!' });
    });
  });
});
