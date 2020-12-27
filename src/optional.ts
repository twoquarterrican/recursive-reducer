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
