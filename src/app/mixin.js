// Copies the methods of command classes onto a class, so one big class can be split across files
// without changing how it is called. A name defined twice is a mistake, so it throws.

export function mixin(target, ...sources) {
  for (const source of sources) {
    for (const name of Object.getOwnPropertyNames(source.prototype)) {
      if (name === 'constructor') {
        continue;
      }

      if (Object.prototype.hasOwnProperty.call(target.prototype, name)) {
        throw new Error(`${target.name}.${name} is defined twice (again in ${source.name}).`);
      }

      Object.defineProperty(target.prototype, name, Object.getOwnPropertyDescriptor(source.prototype, name));
    }
  }
}
