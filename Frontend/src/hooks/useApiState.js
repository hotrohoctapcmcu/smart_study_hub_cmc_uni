export const useApiState = (initialData = null) => {
  const data = { value: initialData };
  const listeners = new Set();

  return {
    get data() {
      return data.value;
    },
    set data(val) {
      data.value = val;
      listeners.forEach((fn) => fn(val));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
};
