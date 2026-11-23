/**
 * Tells TypeScript that importing a .css file is allowed.
 * The build (esbuild) collects every imported stylesheet into app.css.
 */
declare module '*.css';
