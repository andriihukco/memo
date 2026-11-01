type Doc = { title: string; draft: string; updated: string; sections: readonly { h: string; p: readonly string[] }[] };

export function LegalPage({ doc }: { doc: Doc }) {
  return (
    <article className="mx-auto max-w-2xl px-4 pb-16 pt-32 sm:px-6">
      <h1 className="heading-2 hero-ink pb-1">{doc.title}</h1>
      <p className="caption-4 mt-4 text-muted-foreground tabular-nums">
        <time dateTime={doc.updated}>{doc.updated}</time> · {doc.draft}
      </p>
      {doc.sections.map((s) => (
        <section key={s.h} className="mt-10">
          <h2 className="heading-6">{s.h}</h2>
          {s.p.map((line) => (
            <p key={line} className="body-3 mt-3 text-foreground/85">{line}</p>
          ))}
        </section>
      ))}
    </article>
  );
}
