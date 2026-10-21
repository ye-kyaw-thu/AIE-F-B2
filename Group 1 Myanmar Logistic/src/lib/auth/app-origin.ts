/** Only configured origins can receive confirmation links, never request headers. */
export function appOrigin(env:Record<string,string|undefined>=process.env):string {
  const configured=env.NEXT_PUBLIC_APP_URL?.trim();
  if(configured) {
    const parsed=new URL(configured);
    const local=["localhost","127.0.0.1","[::1]"].includes(parsed.hostname);
    if(parsed.username||parsed.password||(!local&&parsed.protocol!=="https:")||(local&&!["http:","https:"].includes(parsed.protocol)))throw new Error("Invalid application origin.");
    if(env.NODE_ENV!=="production"||!local)return parsed.origin;
  }
  const deployment=env.VERCEL_PROJECT_PRODUCTION_URL||env.VERCEL_URL;
  if(deployment&&/^[a-zA-Z0-9.-]+$/.test(deployment))return new URL("https://"+deployment).origin;
  if(env.NODE_ENV!=="production")return "http://localhost:3000";
  throw new Error("Set NEXT_PUBLIC_APP_URL to the public HTTPS application origin.");
}
