export const omit = (obj, keyList = []) => {
  const clone = { ...obj };
  keyList.forEach((key) => {
    if (Object.hasOwn(clone, key)) {
      delete clone[key];
    }
  });
  return obj;
};
