type Step = { step: string; ms: number; detail?: string };

export type Trace = {
  measure: <T>(step: string, fn: () => T, detail?: string) => T;
  measureAsync: <T>(
    step: string,
    fn: () => Promise<T>,
    detail?: string,
  ) => Promise<T>;
  end: () => void;
};

export const nullTrace: Trace = {
  measure: (_step, fn) => fn(),
  measureAsync: (_step, fn) => fn(),
  end: () => {},
};

export const startTrace = (name: string, enabled: boolean): Trace => {
  if (!enabled) return nullTrace;

  const start = performance.now();
  const steps: Step[] = [];

  const record = (step: string, stepStart: number, detail?: string) => {
    const end = performance.now();
    steps.push({ step, ms: Number((end - stepStart).toFixed(2)), detail });
    performance.measure(`${name}:${step}`, { start: stepStart, end });
  };

  return {
    measure: (step, fn, detail) => {
      const stepStart = performance.now();
      const result = fn();
      record(step, stepStart, detail);
      return result;
    },
    measureAsync: async (step, fn, detail) => {
      const stepStart = performance.now();
      const result = await fn();
      record(step, stepStart, detail);
      return result;
    },
    end: () => {
      const total = performance.now() - start;
      performance.measure(name, { start, end: start + total });
      //eslint-disable-next-line no-console
      console.groupCollapsed(`DEBUG: ${name} ${total.toFixed(2)} ms`);
      //eslint-disable-next-line no-console
      console.table(steps);
      //eslint-disable-next-line no-console
      console.groupEnd();
    },
  };
};
