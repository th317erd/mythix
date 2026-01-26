/* eslint-disable no-magic-numbers */

import * as Path from 'node:path';
import * as FileSystem from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as FileUtils from '../../lib/utils/file-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = Path.dirname(__filename);

describe('FileUtils', () => {
  describe('fileNameWithoutExtension', () => {
    it('removes single extension', () => {
      expect(FileUtils.fileNameWithoutExtension('test.txt')).toBe('test');
    });

    it('removes only last extension', () => {
      expect(FileUtils.fileNameWithoutExtension('test.txt.bin')).toBe('test.txt');
    });

    it('handles files without extension', () => {
      expect(FileUtils.fileNameWithoutExtension('Makefile')).toBe('Makefile');
    });

    it('handles dotfiles', () => {
      // Note: dotfiles are treated as having an extension (everything after the dot)
      expect(FileUtils.fileNameWithoutExtension('.gitignore')).toBe('');
    });

    it('handles dotfiles with extension', () => {
      expect(FileUtils.fileNameWithoutExtension('.eslintrc.json')).toBe('.eslintrc');
    });

    it('handles path with directories', () => {
      expect(FileUtils.fileNameWithoutExtension('/path/to/file.txt')).toBe('/path/to/file');
    });

    it('handles empty string', () => {
      expect(FileUtils.fileNameWithoutExtension('')).toBe('');
    });

    it('handles various extensions', () => {
      expect(FileUtils.fileNameWithoutExtension('script.mjs')).toBe('script');
      expect(FileUtils.fileNameWithoutExtension('data.json')).toBe('data');
      expect(FileUtils.fileNameWithoutExtension('archive.tar.gz')).toBe('archive.tar');
    });
  });

  describe('walkDir', () => {
    const testDir = Path.join(__dirname, '__test_walkdir__');

    beforeAll(() => {
      // Create test directory structure
      FileSystem.mkdirSync(testDir, { recursive: true });
      FileSystem.mkdirSync(Path.join(testDir, 'subdir'), { recursive: true });
      FileSystem.mkdirSync(Path.join(testDir, 'subdir', 'nested'), { recursive: true });
      FileSystem.writeFileSync(Path.join(testDir, 'file1.txt'), 'content1');
      FileSystem.writeFileSync(Path.join(testDir, 'file2.js'), 'content2');
      FileSystem.writeFileSync(Path.join(testDir, 'subdir', 'file3.txt'), 'content3');
      FileSystem.writeFileSync(Path.join(testDir, 'subdir', 'nested', 'file4.txt'), 'content4');
    });

    afterAll(() => {
      // Clean up test directory
      FileSystem.rmSync(testDir, { recursive: true, force: true });
    });

    it('returns all files in directory', () => {
      const files = FileUtils.walkDir(testDir);
      expect(files.length).toBe(4);
    });

    it('returns full file paths', () => {
      const files = FileUtils.walkDir(testDir);
      expect(files.every((f) => f.startsWith(testDir))).toBe(true);
    });

    it('includes files in subdirectories', () => {
      const files = FileUtils.walkDir(testDir);
      const nested = files.filter((f) => f.includes('nested'));
      expect(nested.length).toBe(1);
    });

    it('calls callback for each file', () => {
      const visited = [];
      FileUtils.walkDir(testDir, (fullPath, fileName) => {
        visited.push(fileName);
      });
      expect(visited.length).toBe(4);
      expect(visited).toContain('file1.txt');
      expect(visited).toContain('file2.js');
      expect(visited).toContain('file3.txt');
      expect(visited).toContain('file4.txt');
    });

    it('callback receives correct arguments', () => {
      let callArgs = null;
      FileUtils.walkDir(testDir, (fullPath, fileName, rootPath, depth, stats) => {
        if (fileName === 'file1.txt') {
          callArgs = { fullPath, fileName, rootPath, depth, hasStats: !!stats };
        }
      });
      expect(callArgs.fileName).toBe('file1.txt');
      expect(callArgs.fullPath).toBe(Path.join(testDir, 'file1.txt'));
      expect(callArgs.rootPath).toBe(testDir);
      expect(callArgs.depth).toBe(0);
      expect(callArgs.hasStats).toBe(true);
    });

    it('provides correct depth for nested files', () => {
      const depths = {};
      FileUtils.walkDir(testDir, (fullPath, fileName, rootPath, depth) => {
        depths[fileName] = depth;
      });
      expect(depths['file1.txt']).toBe(0);
      expect(depths['file3.txt']).toBe(1);
      expect(depths['file4.txt']).toBe(2);
    });

    it('filters with function', () => {
      const files = FileUtils.walkDir(testDir, {
        // Filter must allow directories to pass for recursion to work
        filter: (fullPath, fileName, stats) => {
          if (stats.isDirectory()) return true;
          return fullPath.endsWith('.txt');
        },
      });
      expect(files.length).toBe(3);
      expect(files.every((f) => f.endsWith('.txt'))).toBe(true);
    });

    it('filters with RegExp', () => {
      const files = FileUtils.walkDir(testDir, {
        filter: /\.js$/,
      });
      expect(files.length).toBe(1);
      expect(files[0]).toContain('file2.js');
    });

    it('filter function receives all arguments', () => {
      let filterArgs = null;
      FileUtils.walkDir(testDir, {
        filter: (fullFileName, fileName, stats, rootPath, depth) => {
          if (fileName === 'file1.txt') {
            filterArgs = { fullFileName, fileName, hasStats: !!stats, rootPath, depth };
          }
          return true;
        },
      });
      expect(filterArgs.fileName).toBe('file1.txt');
      expect(filterArgs.hasStats).toBe(true);
      expect(filterArgs.rootPath).toBe(testDir);
      expect(filterArgs.depth).toBe(0);
    });

    it('can exclude directories via filter', () => {
      const files = FileUtils.walkDir(testDir, {
        filter: (fullPath) => !fullPath.includes('nested'),
      });
      expect(files.length).toBe(3);
      expect(files.some((f) => f.includes('nested'))).toBe(false);
    });

    it('supports callback as second argument', () => {
      const visited = [];
      const files = FileUtils.walkDir(testDir, (fullPath, fileName) => {
        visited.push(fileName);
      });
      expect(files.length).toBe(4);
      expect(visited.length).toBe(4);
    });

    it('supports options with callback', () => {
      const visited = [];
      // Note: RegExp filter only matches files, not directories, so nested dirs won't be walked
      // Use a function filter if you need to walk into directories while filtering files
      const files = FileUtils.walkDir(
        testDir,
        { filter: /file1\.txt$/ },
        (fullPath, fileName) => {
          visited.push(fileName);
        },
      );
      expect(files.length).toBe(1);
      expect(visited.length).toBe(1);
      expect(visited[0]).toBe('file1.txt');
    });
  });
});
