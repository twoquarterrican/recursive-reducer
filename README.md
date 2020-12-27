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
operations on lists. In the same way `objReducer` can be used to do such
operations on an object.

Finding the minimum value...

...of an array
```typescript doctest
const min = [10, 12, 5, 13, 9].reduce(
  (prev: number, current: number) => Math.min(prev, current),
  Number.POSITIVE_INFINITY);
expect(min).toBe(5);
```
...of an object
```typescript doctest
import {objReducer} from 'src/recursiveReducer'

const minOf = objReducer(
  (prev: number, current: number) => Math.min(prev, current),
  Number.POSITIVE_INFINITY);
expect(minOf({a: 10, b: 12, c: 90})).toBe(10);
expect(minOf({a: -30, b: 52, c: 23.4})).toBe(-30);
```

# Recursive

