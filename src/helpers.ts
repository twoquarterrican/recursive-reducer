import {
  empty,
  IRecordLookupResult,
  Optional,
  present,
  recursiveMapper,
  recursiveMapperReducer,
  TPath,
} from './recursiveReducer';

/**
 * Helper/utility function to recursively iterate over an object and
 * collect all non-empty mapped values to a list.
 *
 * @param optMapper takes any value and maps it to an optional of the declared
 * generic type. Empty optional means this value does not contribute to the
 * result. Present optional means this value contributes one item to the resulting
 * list.
 * Example: apply a filter
 * @example
 * ```
 * import { extractAll } from 'index';
 * const extractNumbers = extractAll((a: any) => typeof a === 'number' ? present(a) : empty());
 * expect(extractNumbers([3, 'a', {b: 7, c: 9}, {d: [11, 13]}])).toStrictEqual([
 *  3, 7, 9, 11, 13,
 * ]);
 * expect(extractNumbers(undefined)).toStrictEqual([]);
 * expect(extractNumbers(null)).toStrictEqual([]);
 * expect(extractNumbers([])).toStrictEqual([]);
 * expect(extractNumbers([3])).toStrictEqual([3]);
 * expect(extractNumbers({3:1})).toStrictEqual([1]);
 * expect(extractNumbers({3:[1]})).toStrictEqual([1]);
 * ```
 */
export const extractAll = <T>(optMapper: (a: unknown) => Optional<T>) => (
  a: unknown,
): T[] => {
  return recursiveMapperReducer(
    () => [],
    (prev: any[], current: any[]) => {
      prev.push(...current);
      return prev;
    },
    () => [],
    (a_: any): Optional<T[]> => {
      const optionalt: Optional<T> = optMapper(a_);
      if (optionalt.isPresent) {
        return present([optionalt.value!]);
      } else {
        return empty();
      }
    },
  )(a);
};

/**
 * Look up a value in any object. Stop when reaching null or undefined.
 * Return the resolvedPath, unresolvedPath, and value.
 * @param path list of keys/indexes to look up
 * @param valueKeyFn function taking an object and a key (string or number)
 * and producing another value. Default is (value, key) => value[key]
 * @example
 * ```
 * import {recordLookup} from './index';
 *
 * const input = {a: true, b: [7]};
 * expect(recordLookup(['a'])(input)).toStrictEqual({
 *   resolvedPath: ['a'],
 *   unresolvedPath: [],
 *   value: true,
 *   values: [input],
 * });
 * expect(recordLookup(['a', 0])(input)).toStrictEqual({
 *   resolvedPath: ['a', 0],
 *   unresolvedPath: [],
 *   value: undefined,
 *   values: [input, input['a']],
 * });
 * expect(recordLookup(['b'])(input)).toStrictEqual({
 *   resolvedPath: ['b'],
 *   unresolvedPath: [],
 *   value: [7],
 *   values: [input],
 * });
 * expect(recordLookup(['b', 0])(input)).toStrictEqual({
 *   resolvedPath: ['b', 0],
 *   unresolvedPath: [],
 *   value: 7,
 *   values: [input, input['b']],
 * });
 * expect(recordLookup(['c'])(input)).toStrictEqual({
 *   resolvedPath: ['c'],
 *   unresolvedPath: [],
 *   value: undefined,
 *   values: [input],
 * });
 * expect(recordLookup(['c', 0])(input)).toStrictEqual({
 *   resolvedPath: ['c'],
 *   unresolvedPath: [0],
 *   value: undefined,
 *   values: [input],
 * });
 * ```
 *
 * @example
 * ```
 * const input = { a: ['h', 'e', {l: 'lo'}] }
 * const valueKeyFn = (value: any, key: string | number) => {
 *   const result = value[key];
 *   if (typeof key === 'string' && key.endsWith('!') && !result) {
 *     throw new Error(`Value at ${key.substr(0, key.length - 1)} is not present`);
 *   }
 *   return result;
 * }
 * expect(recordLookup(['a', 2, 'l'], valueKeyFn)(input)).toStrictEqual({
 *   resolvedPath: ['a', 2, 'l'],
 *   unresolvedPath: [],
 *   value: 'lo',
 *   values: [input, input['a'], input['a'][2]],
 * }
 * ```
 */
export const recordLookup = (
  path: TPath,
  valueKeyFn = (value: any, key: string | number) => value[key],
): ((record: any) => IRecordLookupResult) => {
  return (record: any) => {
    const resolvedPath = [];
    const unresolvedPath = [...path];
    let value: any = record;
    const values: any[] = [];
    for (const key of path) {
      if (value === null || value === undefined) {
        break;
      } else {
        values.push(value);
        value = valueKeyFn(value, key);
        resolvedPath.push(key);
        unresolvedPath.shift();
      }
    }
    return {
      resolvedPath,
      unresolvedPath,
      value,
      values,
    };
  };
};

interface IPromisePath {
  promise: Promise<unknown>;
  path: TPath;
}

/**
 * Promise.all takes an array of promises and gives a promise of an array.
 * This method is like Promise.all, but for nested objects and arrays.
 * If you give an object with nested promises and arrays of promises, etc.
 * then you get a promise which, when resolved, gives a value containing
 * the resolved values of those promises, nested in the same way.
 * @param a the value containing promises.
 * @param limit default 10, set to undefined to continue to resolve promises forever
 * This is useful if you have a promise that returns a value that has a nested
 * promise that returns a value that has a nested promise... and so on
 * @example
 * ```
 * import { extractAll, promiseAll, present, empty } from 'index';
 *
 * expect(await promiseAll({a: Promise.resolve(1), b: Promise.resolve(2)}))
 *    .toStrictEqual({a: 1, b: 2});
 * expect(await promiseAll({
 *   a: Promise.resolve({
 *     aa: Promise.resolve(1),
 *     ab: 2,
 *     ac: [Promise.resolve(3), '10']
 *   }),
 *   b: Promise.resolve(2),
 * })).toStrictEqual({
 *   a: {
 *     aa: 1,
 *     ab: 2,
 *     ac: [3, '10'],
 *   },
 *   b: 2,
 * });
 * try {
 *   await promiseAll(Promise.resolve([Promise.resolve(1)]), 1);
 *   fail('expected error');
 * } catch (e) {
 *   expect(String(e)).toStrictEqual('Error: Could not resolve all promises with limit 1. Sorry.');
 * }
 * expect(await promiseAll(Promise.resolve([Promise.resolve(1)]), 2))
 *   .toStrictEqual([1]);
 * ```
 */
export const promiseAll = async (
  a: unknown,
  limit: number | undefined = 10,
): Promise<unknown> => {
  let valueToExtractPromisesFrom = a;
  for (let count = 0; ; count++) {
    const { promisePaths, promisified } = await extractPromises(
      valueToExtractPromisesFrom,
    );
    if (promisePaths.length === 0) return (promisified as unknown[])[0];
    if (limit && count >= limit) {
      throw new Error(
        `Could not resolve all promises with limit ${limit}. Sorry.`,
      );
    }
    promisePaths.sort((promisePath1, promisePath2) => {
      return promisePath1.path.length > promisePath2.path.length ? -1 : 1;
    });
    const promises = promisePaths.map((p) => p.promise);
    const resolvedValues: unknown[] = await Promise.all(promises);
    for (let i = 0; i < promises.length; i++) {
      const resolvedValue = resolvedValues[i];
      const path: TPath = promisePaths[i]!.path;
      const parentPath = path.slice(0, path.length - 1);
      const { value: parent } = recordLookup(parentPath)(promisified);
      parent[path[path.length - 1]!] = resolvedValue;
    }
    valueToExtractPromisesFrom = (promisified as unknown[])[0];
  }
};

const extractPromises = async (a: unknown) => {
  const promisePaths: IPromisePath[] = [];
  const promisified: unknown = await recursiveMapper(
    () => (b: unknown, path: TPath): Optional<Promise<unknown>> => {
      if (b instanceof Promise) {
        promisePaths.push({
          promise: b as Promise<unknown>,
          path,
        });
        return present(b);
      }
      return empty();
    },
  )([a]);
  return { promisePaths, promisified };
};
