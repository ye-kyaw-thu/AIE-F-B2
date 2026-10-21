import {LanguageSwitch} from "@/components/i18n/language-switch";

import {T} from "@/components/i18n/language-provider";
import Link from "next/link";

export function Wordmark({href="/"}:{href?:string}){
  return <Link href={href} className="public-wordmark" aria-label="Myanmar Trading home"><svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true"><path d="M3 26V8l9 9 5-6 5 6 9-9v18M3 26h28" stroke="currentColor" strokeWidth="2"/><circle cx="17" cy="4" r="2" fill="currentColor"/></svg><span>Myanmar Trading<small><T>LOGISTICS & CONNECTIONS</T></small></span></Link>;
}

export function RouteDrawing(){
  return <svg className="route-drawing" viewBox="0 0 520 560" role="img" aria-label="Illustrated route diagram connecting Yangon, Mandalay, Muse and Myawaddy, not a navigation map">
    <defs><pattern id="route-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="currentColor" strokeWidth=".5" opacity=".12"/></pattern></defs>
    <rect width="520" height="560" fill="url(#route-grid)"/>
    <g fill="none" stroke="currentColor" opacity=".12" strokeWidth="1"><path d="M55 180C165 30 275 90 405 165S510 360 400 420 215 540 140 440 0 330 55 180Z"/><path d="M70 194C168 65 265 117 380 182S475 345 380 393 227 500 160 419 18 330 70 194Z"/><path d="M103 216C182 99 250 153 350 203S444 327 356 365 235 459 188 393 52 332 103 216Z"/><path d="M132 238C196 137 253 190 324 226S401 307 331 340 252 421 214 365 98 323 132 238Z"/></g>
    <path d="M205 437C222 386 207 338 227 298S218 225 267 191 300 166 334 110" fill="none" stroke="#b25336" strokeWidth="3"/>
    <path d="M205 437C250 395 291 407 360 397" fill="none" stroke="#b25336" strokeWidth="2" strokeDasharray="6 6"/>
    <g fill="#f0e9dc" stroke="#b25336" strokeWidth="2"><circle cx="205" cy="437" r="7"/><circle cx="267" cy="191" r="6"/><circle cx="334" cy="110" r="7"/><circle cx="360" cy="397" r="7"/></g>
    <g fill="currentColor" fontFamily="inherit"><text x="352" y="104" fontSize="21"><T>Muse</T></text><text x="352" y="124" fontSize="10" letterSpacing="1"><T>CHINA BORDER</T></text><text x="155" y="185" fontSize="20"><T>Mandalay</T></text><text x="110" y="455" fontSize="22"><T>Yangon</T></text><text x="375" y="393" fontSize="18"><T>Myawaddy</T></text><text x="375" y="413" fontSize="9" letterSpacing=".8"><T>THAILAND BORDER</T></text><text x="62" y="340" fontSize="10" letterSpacing="3" opacity=".5" transform="rotate(-90 62 340)"><T>BAY OF BENGAL</T></text></g>
    <g transform="translate(221 280)"><rect x="-17" y="-17" width="34" height="34" rx="17" fill="#b25336"/><path d="M-9-5H2v12H-9zM2 0h5l3 4v3H2M5 0v4h5" stroke="#fffaf0" fill="none" strokeWidth="1.3"/><circle cx="-5" cy="8" r="2" fill="#fffaf0"/><circle cx="6" cy="8" r="2" fill="#fffaf0"/></g>
    <path d="M430 55v-22m-6 6 6-6 6 6" stroke="currentColor" fill="none"/><text x="430" y="24" textAnchor="middle" fill="currentColor" fontSize="10">N</text>
    <g transform="translate(288 479) rotate(-8)"><rect width="178" height="46" fill="none" stroke="#b25336"/><text x="89" y="19" fill="#b25336" textAnchor="middle" fontSize="9" letterSpacing="2"><T>ORIGIN → DESTINATION</T></text><text x="89" y="35" fill="#b25336" textAnchor="middle" fontSize="10"><T>Every handoff matters.</T></text></g>
  </svg>;
}

export function AuthFrame({children}:{children:React.ReactNode}){
  return <div className="public-site auth-site"><header className="site-header"><Wordmark /><LanguageSwitch/><Link href="/" className="underlined-link"><T>Back to home ↗</T></Link></header><main className="auth-spread"><aside className="auth-story"><p className="editorial-label"><T>YOUR NEXT JOURNEY</T></p><h2><T>Good trade starts</T><br /><T>with a clear</T><br /><em><T>connection.</T></em></h2><div className="auth-route"><span><T>YANGON</T></span><i/><span><T>WHEREVER’S NEXT</T></span></div><p><T>Your shipments. Your team.</T><br /><T>A little less distance between them.</T></p><span className="auth-story-bottom"><T>MYANMAR TRADING / LOGISTICS & CONNECTIONS</T></span></aside><section className="auth-form-side">{children}</section></main><footer className="auth-footer">Myanmar Trading <span><T>Built around the way goods move.</T></span></footer></div>;
}
