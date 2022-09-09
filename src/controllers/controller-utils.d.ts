import { Application } from "../application";
import { HTTPServer } from "../http-server";
import { GenericObject } from "../interfaces/common";
import { ControllerClass } from "./controller-base";

export declare interface BuildPatternMatcherOptions {
  strict?: boolean;
  sanitize?: (value: string) => string;
  flags?: string;
}

export declare interface PatternMatcherMethod {
  (value: string): boolean;
  regexp: RegExp;
  directPatterns: Array<RegExp>;
}

export declare interface PathMatcherMethod {
  (pathPart: string): GenericObject | undefined;
  regexp: RegExp;
  params: Array<string>;
  sanitizedPath: string;
}

export declare type RoutePatterns = string | RegExp | Array<string | RegExp>;

export declare function buildPatternMatcher(
  patterns: RoutePatterns,
  options?: BuildPatternMatcherOptions
): PatternMatcherMethod;

export declare interface DefineControllerContext<T = ControllerClass> {
  Parent: T;
  application: Application;
  server: HTTPServer;
  controllerName: string;
}

export declare function buildMethodMatcher(patterns: RoutePatterns): PatternMatcherMethod;
export declare function buildContentTypeMatcher(patterns: RoutePatterns): PatternMatcherMethod;
export declare function buildPathMatcher(routeName: string, customParserTypes: GenericObject): PathMatcherMethod;
export declare function buildRoutes(routes: GenericObject | Array<GenericObject>, customParserTypes?: GenericObject): Array<GenericObject>;

export declare function defineController<T = ControllerClass>(
  controllerName: string,
  definer: (context: DefineControllerContext<T>) => ControllerClass,
  parent?: T
): (context: {
  application: Application,
  server: HTTPServer,
}) => ControllerClass;
