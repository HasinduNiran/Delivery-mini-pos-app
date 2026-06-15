// Side-effect CSS imports (NativeWind global.css) and CSS modules.
declare module '*.css';
declare module '*.module.css' {
  const styles: { readonly [key: string]: string };
  export default styles;
}
