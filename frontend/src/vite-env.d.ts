/**
 * TypeScript declaration for CSS Module files.
 * Allows importing .module.css files with type-safe class names.
 */
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
