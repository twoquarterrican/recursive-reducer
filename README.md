# Any reducer

The method `reduce` in `Array` can be used to implement `map`, `filter`,
`count`, and other generally useful operations. It is a core operation
which we extend to objects. There are two versions: non-recursive `objReducer`
and recursive reducers. The recursive reducer has factory methods
`recursiveMapper` and `recursiveMapperReducer` which, roughly speaking,
are useful for "copy-like" operations and "summarization" operations
respectively

## Non-recursive

Recall `Array.reduce` can be used to do various summaries or map-and-copy
operations on lists. In the same way, `objReducer` can be used to do such
operations on an object.

### Example 1: Finding the minimum value...

...of an array, using `Array.reduce`
```typescript doctest
const minOf = (arr: number[]) => arr.reduce(
  (prev: number, current: number) => Math.min(prev, current),
  Number.POSITIVE_INFINITY);
expect(minOf([10, 12, 90])).toBe(10);
expect(minOf([-30, 52, 23.4])).toBe(-30);
```
...of a record, using `recordReducer`
```typescript doctest
import {recordReducer} from 'index'; // 'recursive-reducer'

const minOf = recordReducer(
  (prev: number, current: number | undefined) => Math.min(prev, current!),
  () => Number.POSITIVE_INFINITY);
expect(minOf({a: 10, b: 12, c: 90})).toBe(10);
expect(minOf({a: -30, b: 52, c: 23.4})).toBe(-30);
```

### Example 2: Async map (to boolean) and reduce (with &&)...

...of an array, using `Array.reduce`
```typescript doctest
const allEven = async (arr: number[]) => await arr.reduce(
  async (prev: Promise<boolean>, current: number) => (await prev) && current % 2 === 0,
  Promise.resolve(true));
expect(await allEven([])).toBe(true);
expect(await allEven([3])).toBe(false);
expect(await allEven([3, 5])).toBe(false);
expect(await allEven([4, 6])).toBe(true);
expect(await allEven([4, 7])).toBe(false);
```
...of a record, using `recordReducer`

```typescript doctest
import {recordReducer} from 'index'; // 'recursive-reducer'

const allEven = recordReducer(
  async (prev: Promise<boolean>, current: number | undefined) => (await prev) && current! % 2 === 0,
  () => Promise.resolve(true));
expect(await allEven({})).toBe(true);
expect(await allEven({a: 3})).toBe(false);
expect(await allEven({a: 3, b: 5})).toBe(false);
expect(await allEven({a: 4, b: 6})).toBe(true);
expect(await allEven({a: 4, b: 7})).toBe(false);
```

# Recursive

