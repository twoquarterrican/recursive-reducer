/**
 * Create a function that can be applied to any object.
 * The function will take the initial value, then iterate
 * over the entries in the object, computing a new value
 * from each using the callback. After the iteration is done,
 * the value is returned.
 *
 * Note: the initial value is a function. This matters if you have
 * a callback that mutates the "prev" argument. If you invoke the
 * apply the function to another object, you will not have
 * left-over side-effects from the first application as long as
 * the initial function supplies a new value each time or an
 * immutable value.
 *
 * @param callback similar to the callback in Array.reduce
 * @param initial function to supply initial value
 *
 * @example
 * ```
 * import {recordReducer} from 'index'
 *
 * const reducer = recordReducer((prev: any[], current: any, _key: string) => {
 *     prev.push(current)
 *     return prev
 *   },
 *   () => [])
 * // extracts values to a list
 * expect(reducer({a: true, b: [7], c: 90})).toStrictEqual([true, [7], 90])
 * // second use of same reducer
 * expect(reducer({a: {}, b: null, c: "h"})).toStrictEqual([{}, null, "h"])
 * ```
 */
export const recordReducer = <S, T>(
  callback: (prev: T, current: S | undefined, key: string) => T,
  initial: () => T,
): ((record: Record<string, S>) => T) => {
  return (record: Record<string, S>): T => {
    let value = initial();
    for (const key of Object.keys(record)) {
      value = callback(value, record[key], key);
    }
    return value;
  };
};

interface IArrReduction<S, T> {
  callback: (prev: T, current: S, index: number) => T;
  initial: () => T;
}

const ARR_COPY_REDUCTION: IArrReduction<any, any[]> = {
  callback: (prev: any[], current: any) => {
    prev.push(current);
    return prev;
  },
  initial: () => [],
};

const arrCopyReduction = <S>(): IArrReduction<S, S[]> =>
  ARR_COPY_REDUCTION as IArrReduction<S, S[]>;

interface IObjReduction<S, T> {
  callback: (prev: T, current: S, key: string) => T;
  initial: () => T;
}

const OBJ_COPY_REDUCTION: IObjReduction<any, any> = {
  callback: (prev: any, current: any, key: string) => {
    prev[key] = current;
    return prev;
  },
  initial: () => ({}),
};

const objCopyReduction = <S>(): IObjReduction<S, S> =>
  OBJ_COPY_REDUCTION as IObjReduction<S, S>;

export type TPath = (string | number)[];

export interface IRecordLookupResult {
  resolvedPath: TPath;
  unresolvedPath: TPath;
  value: any;
  values: any[];
}

export type TPathFn<S, T> = (s: S, path: TPath) => T;

export interface Optional<T> {
  isPresent: boolean;
  value?: T;
}

export const present = <T>(value: T) => ({
  isPresent: true,
  value,
});

const EMPTY = {
  isPresent: false,
};

export const empty = <T>() => EMPTY as Optional<T>;
const extendArrPathFn = <T>(
  arrPathFn: TPathFn<any[], T>,
): TPathFn<any, Optional<T>> => {
  return (a: any, path: TPath): Optional<T> => {
    if (Array.isArray(a)) {
      return present(arrPathFn(a, path));
    } else {
      return empty();
    }
  };
};

const arrReductionToRecursivePathFn = <R, S, T>(
  arrReduction: IArrReduction<S, T>,
  recurse: TPathFn<R, S>,
): TPathFn<R[], T> => {
  return (rs: R[], path: TPath): T => {
    const { callback, initial } = arrReduction;
    return rs.reduce((prev: T, current: R, index: number) => {
      const s: S = recurse(current, [...path, index]);
      return callback(prev, s, index);
    }, initial());
  };
};

const extendObjPathFn = <T>(
  objPathFunction: TPathFn<Record<string, unknown>, T>,
): TPathFn<any, Optional<T>> => {
  return (a: any, path: TPath): Optional<T> => {
    if (a !== null && typeof a === 'object') {
      return present(objPathFunction(a, path));
    } else {
      return empty();
    }
  };
};

const objReductionToRecursivePathFn = <R, S, T>(
  objReduction: IObjReduction<R, T>,
  recurse: TPathFn<S | undefined, R>,
): TPathFn<Record<string, S>, T> => {
  const { initial, callback } = objReduction;
  return (obj: Record<string, S>, path: TPath): T =>
    recordReducer((prev: T, current: S | undefined, key: string) => {
      const reducedItem: R = recurse(current, [...path, key]);
      return callback(prev, reducedItem, key);
    }, initial)(obj);
};

/**
 * We use a class to achieve the circular referencing in the recursion.
 * Each 'pathFn' should be able to "dive deeper" into an object it
 * is visiting. It does this by calling a "recurse" function. This function
 * is the "reduceInternal" method of this class.
 */
class RecursiveReducer {
  /**
   * The 'pathFn's themselves are not given in the constructor because
   * the "recurse" function does not exist before an instance of this object
   * is constructed.
   */
  private readonly pathFns: TPathFn<any, Optional<any>>[];

  /**
   * Factories are given in the constructor: they take a reference to the
   * "recurse" function and build the 'objPathFn's which are able to
   * recursively walk an object structure.
   * @param pathFnFactories array of functions that take the "recurse"
   * function and build a path function that can accept any input. The output
   * of each path function is an optional. If a path function returns the
   * empty optional, we move on to the next path function. Otherwise, we
   * take the value from that path function. Therefore, the order of the
   * path function factories is important.
   */
  constructor(
    pathFnFactories: ((
      recurse: TPathFn<any, any>,
    ) => TPathFn<any, Optional<any>>)[],
  ) {
    const recurse: TPathFn<any, any> = this.reduceInternal.bind(this);
    this.pathFns = pathFnFactories.map((factory) => factory(recurse));
  }

  private reduceInternal(current: any, path: TPath): any {
    for (const converter of this.pathFns) {
      const { isPresent, value: convertedValue } = converter(current, path);
      if (isPresent) {
        return convertedValue;
      }
    }
    return current;
  }

  public reduce(a: any) {
    return this.reduceInternal(a, []);
  }
}

/**
 * Internal factory method.
 * Not ready yet to expose this because it is only really
 * usefule with some of the helper functions like extendArrPathFn,
 * arrReductionToRecursivePathFn, arrCopyReduction, etc.
 * These need some time to mature before being tied down to them.
 * @param objPathFnFactories each factory takes a special recursion value which
 * can be used to dig deeper with the resulting TPathFn
 */
const recursiveReducerInternal = (
  ...objPathFnFactories: ((
    recurse: TPathFn<any, any>,
  ) => TPathFn<any, Optional<any>>)[]
) => {
  const recursiveReducerInstance = new RecursiveReducer(objPathFnFactories);
  // re-use the same instance across invocations
  return (a: any) => recursiveReducerInstance.reduce(a);
};

/**
 * Factory method for recursive reducer.
 * Typical examples copy nested objects with some modifications to certain
 * values.
 * @param pathFnFactory maps entries to other values
 *
 * @example
 * ```
 * import {
 *   recursiveMapper, TPath, TPathFn, Optional, present, empty,
 * } from 'index';
 *
 * const wrapInArray: TPathFn<any, Optional<any[]>> = (a: any, path: TPath) => {
 *   if (path[path.length - 1] === 'values' && !Array.isArray(a)) {
 *     return present([a]);
 *   } else {
 *     return empty();
 *   }
 * }
 * const recursivelyWrapInArray = recursiveMapper(() => wrapInArray);
 * expect(recursivelyWrapInArray({
 *   a: 1, b: [{values: 3, other: [true, false]}, null, {values: [3, 7]}],
 *   values: "hello",
 * })).toStrictEqual({
 *   a: 1, b: [{values: [3], other: [true, false]}, null, {values: [3, 7]}]
 *   values: ["hello"],
 * });
 * ```
 */
export const recursiveMapper = <T>(
  pathFnFactory: (recurse: TPathFn<any, any>) => TPathFn<any, Optional<T>>,
) =>
  recursiveReducerInternal(
    pathFnFactory,
    (recurse: TPathFn<any, any>) =>
      extendArrPathFn(
        arrReductionToRecursivePathFn(arrCopyReduction(), recurse),
      ),
    (recurse: TPathFn<any, any>) =>
      extendObjPathFn(
        objReductionToRecursivePathFn(objCopyReduction(), recurse),
      ),
  );

/**
 * Factory method for recursive reducer.
 * Typical examples aggregate values in nested objects.
 *
 * @param mapper applied to any non-object, non-array value, returns value that
 * can be used in the reducer
 * @param reduceCallback applied to previous and current values to compute new
 * value. At first, prev comes from reduceInitial(). On subsequent invocations,
 * prev comes from previous invocations. The current parameter in this callback
 * comes from the output of the mapper function.
 * @param reduceInitial provides initial value for reduction. Should always
 * provide a new object or else an immutable object.
 * @param optionalMapper this mapper is optional in the sense that you do
 * not need to pass this parameter and its return type is Optional.
 * This optional mapper can be used to compute values non-recursively. If
 * it returns a non-empty Optional, say present(x), then no more recursion
 * is done at this node of the object. If it returns empty, then recursion
 * will continue. See examples below for how to use this optional mapper.
 *
 * @example
 * ```
 * import {recursiveMapperReducer} from 'index';
 * const sumNumbers = recursiveMapperReducer(
 *   (a: any) => typeof a === 'number' ? a : 0,
 *   (prev: number, current: number) => prev + current,
 *   () => 0,
 * );
 * // extracts values to a list
 * expect(sumNumbers({a: true, b: [7], c: 90})).toBe(97);
 * // second use of same reducer
 * expect(sumNumbers({a: {}, b: null, c: "h"})).toBe(0);
 * ```
 * @example
 * ```
 * import {recursiveMapperReducer} from 'index';
 * const countEmptyArrays = recursiveMapperReducer(
 *   () => 0, // all-non array values are mapped to 0
 *   (prev: number, current: number) => prev + current,
 *   () => 0,
 *   (a: any) => Array.isArray(a) && a.length === 0 ? present(1) : empty(),
 * );
 * expect(countEmptyArrays({a: true, b: [7], c: 90})).toBe(0);
 * expect(countEmptyArrays({a: {}, b: null, c: []})).toBe(1);
 * expect(countEmptyArrays({a: {}, b: [[]], c: []})).toBe(2);
 * ```
 */
export const recursiveMapperReducer = <S, T>(
  mapper: (a: any) => S,
  reduceCallback: (prev: T, current: S) => T,
  reduceInitial: () => T,
  optionalMapper: (a: any) => Optional<T> = () => empty(),
) =>
  recursiveReducerInternal(
    () => optionalMapper,
    (recurse: TPathFn<any, any>) =>
      extendArrPathFn(
        arrReductionToRecursivePathFn(
          {
            initial: reduceInitial,
            callback: reduceCallback,
          },
          recurse,
        ),
      ),
    (recurse: TPathFn<any, any>) =>
      extendObjPathFn(
        objReductionToRecursivePathFn(
          {
            initial: reduceInitial,
            callback: reduceCallback,
          },
          recurse,
        ),
      ),
    // last part is not recursive
    () => (a: any) => present(mapper(a)),
  );

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
export function recordLookup(
  path: TPath,
  valueKeyFn = (value: any, key: string | number) => value[key],
): (record: any) => IRecordLookupResult {
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
}
