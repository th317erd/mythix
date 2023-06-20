import { Stats } from 'fs';

export declare interface WalkDirOptions {
  filter: RegExp | ((fullFileName: string, fileName: string, stats: Stats, rootPath: string, depth: number) => boolean);
}

export declare type WalkDirCallback = () => void;

export declare function walkDir(rootPath: string, options?: WalkDirOptions | WalkDirCallback, callback?: WalkDirCallback);
export declare function fileNameWithoutExtension(fileName: string): string;
