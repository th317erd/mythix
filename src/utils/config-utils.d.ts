import { GenericObject } from '../interfaces/common';

export declare function wrapConfig(config?: GenericObject): { CONFIG: GenericObject, ENV: (key: string, defaultValue) => any; };
