import {
  recursiveReducer,
  recursiveReducerFromMapper,
  anyReducerFromMapReduce,
  arrCopyReduction,
  arrPathFunction,
  empty,
  objCopyReduction,
  objPathFunction,
  objReducer,
  present,
  TPath,
} from "src/recursiveReducers";

test("copy object recursively, prepending path to all string values", () => {
  const prependPathToStringValues = recursiveReducer(
    () => (current: any, path: TPath) => {
      return typeof current === "string"
        ? present(`[${path}]:${current}`)
        : empty();
    },
    arrPathFunction(arrCopyReduction),
    objPathFunction(objCopyReduction)
  );
  expect(prependPathToStringValues({})).toStrictEqual({});
  expect(prependPathToStringValues({ a: "value1" })).toStrictEqual({
    a: "[a]:value1",
  });
  expect(
    prependPathToStringValues({
      a: "value1",
      b: ["b0", "b1", { c1: "c1Value", c2: true, c3: 9 }],
    })
  ).toStrictEqual({
    a: "[a]:value1",
    b: ["[b,0]:b0", "[b,1]:b1", { c1: "[b,2,c1]:c1Value", c2: true, c3: 9 }],
  });
  expect(prependPathToStringValues("abc")).toStrictEqual("[]:abc");
  expect(prependPathToStringValues(true)).toBe(true);
  expect(prependPathToStringValues(9)).toBe(9);
  expect(prependPathToStringValues([0, {}, [], "x"])).toStrictEqual([
    0,
    {},
    [],
    "[3]:x",
  ]);
});

test("count the number of boolean values in an object", () => {
  const countBooleans = recursiveReducer(
    arrPathFunction(() => ({
      initial: 0,
      callback: (prev: number, current: any) => prev + current,
    })),
    objPathFunction(() => ({
      initial: 0,
      callback: (prev: number, current: any) => prev + current,
    })),
    () => (a: any) => (typeof a === "boolean" ? present(1) : present(0))
  );
  expect(countBooleans({})).toBe(0);
  expect(countBooleans({ a: "value1" })).toBe(0);
  expect(
    countBooleans([
      {
        1: { 2: [{ name: "FALSE", value: 0, arr: [false] }] },
        b: ["b0", "b1", { c1: "c1Value", c2: true, c3: 9 }],
      },
      true,
      false,
      [0, "a", null, undefined],
      false,
      { "some value": false },
      { true: "false" },
    ])
  ).toBe(6);
});

test("does object have a number greater than 10?", () => {
  const anyValueGt10 = anyReducerFromMapReduce(
    (a: any) => typeof a === "number" && a > 10,
    (prev: boolean, current: boolean) => prev || current,
    () => false
  );
  expect(anyValueGt10({})).toBe(false);
  expect(anyValueGt10([])).toBe(false);
  expect(anyValueGt10(null)).toBe(false);
  expect(anyValueGt10(undefined)).toBe(false);
  expect(anyValueGt10([null])).toBe(false);
  expect(anyValueGt10([10])).toBe(false);
  expect(anyValueGt10(11)).toBe(true);
  expect(anyValueGt10({ 11: 10 })).toBe(false);
  expect(anyValueGt10({ 10: 11 })).toBe(true);
  expect(
    anyValueGt10([
      {
        1: { 2: [{ name: "FALSE", value: 0, arr: [false] }] },
        b: ["b0", "b1", { c1: "c1Value", c2: true, c3: 9 }],
      },
      true,
      false,
      [0, "a", null, undefined],
      false,
      { "some value": false },
      { true: "false" },
    ])
  ).toBe(false);
  expect(anyValueGt10([{ x: 10 }, { y: 9 }, { z: 11 }, { w: -2 }])).toBe(true);
});

test("Subtract 14 from every number", () => {
  const subtract14 = recursiveReducerFromMapper((a: any) =>
    typeof a === "number" ? present(a - 14) : empty()
  );
  expect(subtract14([10])).toStrictEqual([-4]);
  expect(subtract14(11)).toBe(-3);
  expect(subtract14({ 11: 0 })).toStrictEqual({ 11: -14 });
  expect(subtract14({ 10: -11 })).toStrictEqual({ 10: -25 });
  expect(
    subtract14({ 32: { "hot sauce": [79, null] }, true: [undefined] })
  ).toStrictEqual({ 32: { "hot sauce": [65, null] }, true: [undefined] });
});

test("Sum the values in an object", () => {
  const reducer = objReducer(
    (prev: number, current: number | undefined, _key: string) =>
      prev + (current ?? 0),
    () => 0
  );
  expect(reducer({ a: 3, b: 10, c: -8 })).toBe(5);
});

test("Collect the numbers in an object to a list", () => {
  const reducer = objReducer(
    (prev: number[], current: any, _key: string) => {
      if (typeof current === "number") {
        prev.push(current);
      }
      return prev;
    },
    () => []
  );
  expect(
    reducer({ a: 3, b: 10, c: -8, d: null, e: true, f: 9, g: [] })
  ).toStrictEqual([3, 10, -8, 9]);
});
