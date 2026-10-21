"use client";
import {T} from "@/components/i18n/language-provider";


export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="state-page">
      <p className="eyebrow"><T>SOMETHING WENT WRONG</T></p>
      <h1><T>We couldn’t load this view.</T></h1>
      <p className="muted"><T>Please try again to reload the workspace.</T></p>
      <button className="button button-dark" onClick={retry}><T>Try again</T></button>
    </main>
  );
}
