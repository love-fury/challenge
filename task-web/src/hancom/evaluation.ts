export function serializePageFunctionCall<TArgs extends unknown[]>(
  pageFunction: (...args: TArgs) => unknown,
  ...args: TArgs
): string {
  return `(() => {
    const __name = (target, _name) => target;
    const getRuntimeGlobal = () => globalThis;
    return (${pageFunction.toString()})(...${JSON.stringify(args)});
  })()`;
}
