export const omit = <T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Omit<T, K> => {
  const result = { ...source };

  for (const key of keys) {
    Reflect.deleteProperty(result, key);
  }

  return result;
};
