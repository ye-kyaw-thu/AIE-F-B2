export type Locale = "my" | "en";
export function resolveLocale(value?:string):Locale { return value === "en" ? "en" : "my"; }
