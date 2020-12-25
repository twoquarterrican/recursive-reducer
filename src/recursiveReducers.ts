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
 * import {objReducer} from 'src/index'
 *
 * const reducer = objReducer((prev: any[], current: any, _key: string) => {
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
export const objReducer = <S, T>(
  callback: (prev: T, current: S | undefined, key: string) => T,
  initial: () => T,
): ((obj: { [k: string]: S }) => T) => {
  return (obj: { [k: string]: S }): T => {
    let value = initial();
    for (let key of Object.keys(obj)) {
      value = callback(value, obj[key], key);
    }
    return value;
  };
};

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

export interface IArrReduction<S, T> {
  initial: () => T;
  callback: (prev: T, current: S, index: number) => T;
}

const ARR_COPY_REDUCTION: IArrReduction<any, any[]> = {
  initial: () => [],
  callback: (prev: any[], current: any) => {
    prev.push(current);
    return prev;
  },
};

const arrCopyReduction = <S>(): IArrReduction<S, S[]> => ARR_COPY_REDUCTION as IArrReduction<S, S[]>;

export interface IObjReduction<S, T> {
  initial: () => T;
  callback: (prev: T, current: S, key: string) => T;
}

const objCopyReduction = <S>(): IObjReduction<S, any> => ({
  initial: {} as any,
  callback: (prev: any, current: S, key: string) => {
    prev[key] = current;
    return prev;
  },
});

export type TPath = (string | number)[];
export type TPathFn<S, T> = (s: S, path: TPath) => T;

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
    return rs.reduce(
      (prev: T, current: R, index: number) => {
        const s: S = recurse(current, [...path, index]);
        return callback(prev, s, index);
      },
      initial(),
    );
  };
};


const extendObjPathFn = <T>(
  objPathFunction: TPathFn<object, T>,
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
): TPathFn<{ [k: string]: S }, T> => {
  const { initial, callback } = objReduction;
  return (obj: { [k: string]: S }, path: TPath): T =>
    objReducer(
      (prev: T, current: S | undefined, key: string) => {
        const reducedItem: R = recurse(current, [...path, key]);
        return callback(prev, reducedItem, key);
      },
      initial,
    )(obj);
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
    for (let converter of this.pathFns) {
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
 * Create reducer that can be used an any type. Will
 * recurse until value matches converter.
 * @param objPathFnFactories take a special recursion value to dig deeper, produce a TObjPathFunction
 */
export const recursiveReducer = (
  ...objPathFnFactories: ((
    recurse: TPathFn<any, any>,
  ) => TPathFn<any, Optional<any>>)[]
) => {
  const recursiveReducerInstance = new RecursiveReducer(objPathFnFactories);
  // re-use the same instance across invocations
  return (a: any) => recursiveReducerInstance.reduce(a);
};

/**
 *
 * @param mapper
 */
export const recursiveReducerFromMapper = <T>(mapper: (a: any) => Optional<T>) =>
  recursiveReducer(
    () => mapper,
    (recurse: TPathFn<any, any>) => extendArrPathFn(
      arrReductionToRecursivePathFn(
        arrCopyReduction(),
        recurse)),
    (recurse: TPathFn<any, any>) => extendObjPathFn(
      objReductionToRecursivePathFn(
        objCopyReduction(),
        recurse)),
  );

/**
 * Factory method for recursive reducer.
 * Typical examples aggregate values in nested objects.
 *
 * @param map applied to any non-object, non-array value, returns value that
 * can be used in the reducer
 * @param reduceCallback applied to previous and current values to compute new
 * value. At first, prev comes from reduceInitial(). On subsequent invocations,
 * prev comes from previous invocations. The current parameter in this callback
 * comes from the output of the map function.
 * @param reduceInitial provides initial value for reduction. Should always
 * provide a new object or else an immutable object.
 *
 * @example
 * ```
 * import {recursiveReducerFromMapReduce} from 'src/index';
 * const sumNumbers = recursiveReducerFromMapReduce(
 *   (a: any) => typeof a === 'number' ? a : 0,
 *   (prev: number, current: number) => prev + current,
 *   () => 0,
 * );
 * // extracts values to a list
 * expect(sumNumbers({a: true, b: [7], c: 90})).toBe(97);
 * // second use of same reducer
 * expect(sumNumbers({a: {}, b: null, c: "h"})).toBe(0);
 * ```
 */
export const recursiveReducerFromMapReduce = <S, T>(
  map: (a: any) => S,
  reduceCallback: (prev: T, current: S) => T,
  reduceInitial: () => T,
) =>
  recursiveReducer(
    (recurse: TPathFn<any, any>) => extendArrPathFn(
      arrReductionToRecursivePathFn({
        initial: reduceInitial,
        callback: reduceCallback,
      }, recurse)),
    (recurse: TPathFn<any, any>) => extendObjPathFn(
      objReductionToRecursivePathFn({
        initial: reduceInitial,
        callback: reduceCallback,
      }, recurse)),
    // last part is not recursive
    () => (a: any) => present(map(a)),
  );
