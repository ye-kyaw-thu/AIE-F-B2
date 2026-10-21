import {z} from 'zod';
export const emailLinkTypeSchema=z.enum(['invite','recovery','signup','email']);
export const emailLinkSchema=z.object({tokenHash:z.string().regex(/^[a-zA-Z0-9_-]{32,256}$/),type:emailLinkTypeSchema});
export type CallbackCredentials=
  |{kind:'session';accessToken:string;refreshToken:string}
  |{kind:'code';code:string}
  |{kind:'token';tokenHash:string;type:z.infer<typeof emailLinkTypeSchema>}
  |{kind:'error'}|{kind:'empty'};
/** Never trust a destination or provider error text from an email URL. */
export function parseCallbackUrl(input:string):CallbackCredentials{
  const url=new URL(input);const fragment=new URLSearchParams(url.hash.slice(1));
  if(url.searchParams.has('error')||fragment.has('error')||fragment.has('error_code'))return {kind:'error'};
  const accessToken=fragment.get('access_token'),refreshToken=fragment.get('refresh_token');
  if(accessToken&&refreshToken&&accessToken.length<=8192&&refreshToken.length<=8192)return {kind:'session',accessToken,refreshToken};
  const token=emailLinkSchema.safeParse({tokenHash:url.searchParams.get('token_hash'),type:url.searchParams.get('type')});
  if(token.success)return {kind:'token',...token.data};
  const code=url.searchParams.get('code');if(code&&code.length<=2048)return {kind:'code',code};
  return url.searchParams.has('token_hash')||fragment.has('access_token')?{kind:'error'}:{kind:'empty'};
}
