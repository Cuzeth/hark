import type { DocFieldRow, DocPlanRow, DocRouteRow } from "../../../shared/docs/content";
import { type DocAnchorId, type DocSectionId, docLabel } from "../../../shared/docs/nav";
import { Inlines } from "./inlines";

/** Marks a capability that is only available on a paid Hark Pro plan. */
export function ProBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-semibold tracking-wide text-accent-text uppercase">
      Hark Pro
    </span>
  );
}

/** A top-level docs chapter. Its heading text comes from the sidebar nav. */
export function DocSection({
  id,
  pro,
  children,
}: {
  id: DocSectionId;
  pro?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} id={id}>
      <h2
        className="border-b border-line pb-4 text-2xl font-semibold tracking-tight"
        id={`${id}-heading`}
      >
        {docLabel(id)}
      </h2>
      {pro ? (
        <p className="mt-3">
          <ProBadge />
        </p>
      ) : null}
      {children}
    </section>
  );
}

/** A nested, individually linkable subsection. */
export function DocSub({
  id,
  pro,
  children,
}: {
  id: DocAnchorId;
  pro?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="mt-10" id={id}>
      <h3 className="text-base font-semibold" id={`${id}-heading`}>
        {docLabel(id)}
      </h3>
      {pro ? (
        <p className="mt-2">
          <ProBadge />
        </p>
      ) : null}
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-ink-subtle">{children}</p>;
}

export function Lead({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-subtle">{children}</p>;
}

export function Steps({ children }: { children: React.ReactNode }) {
  return (
    <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-subtle">
      {children}
    </ol>
  );
}

export function Bullets({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-subtle">{children}</ul>
  );
}

/** Aside for a caveat that would otherwise get lost in a paragraph. */
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-l-2 border-accent bg-accent-wash py-2 pl-4 text-sm leading-relaxed text-ink-subtle">
      {children}
    </p>
  );
}

function TableShell({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-lg text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

function HeadRow({ headers }: { headers: string[] }) {
  return (
    <thead className="text-xs text-ink-faint">
      <tr>
        {headers.map((header) => (
          <th className="pb-3 font-medium" key={header} scope="col">
            {header}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function FieldTable({ caption, rows }: { caption: string; rows: DocFieldRow[] }) {
  return (
    <TableShell caption={caption}>
      <HeadRow headers={["Field", "Type", "Description"]} />
      <tbody className="divide-y divide-line border-y border-line">
        {rows.map((row) => (
          <tr key={row.name}>
            <th
              className="py-3 pr-5 align-top font-mono text-xs font-normal whitespace-nowrap text-ink-muted"
              scope="row"
            >
              {row.name}
            </th>
            <td className="py-3 pr-5 align-top text-xs whitespace-nowrap text-ink-faint">
              {row.type}
            </td>
            <td className="py-3 align-top text-sm text-ink-subtle">
              <Inlines source={row.detail} />
            </td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

export function RouteTable({ caption, rows }: { caption: string; rows: DocRouteRow[] }) {
  return (
    <TableShell caption={caption}>
      <HeadRow headers={["Route", "Purpose"]} />
      <tbody className="divide-y divide-line border-y border-line">
        {rows.map((row) => (
          <tr key={`${row.method} ${row.path}`}>
            <th
              className="py-3 pr-5 align-top font-mono text-xs font-normal text-ink-muted"
              scope="row"
            >
              <span className="text-accent-text">{row.method}</span> {row.path}
            </th>
            <td className="py-3 align-top text-sm text-ink-subtle">
              <Inlines source={row.detail} />
            </td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

/** Free-versus-Pro comparison, used for the rate-limit table. */
export function PlanTable({ caption, rows }: { caption: string; rows: DocPlanRow[] }) {
  return (
    <TableShell caption={caption}>
      <HeadRow headers={["Limit", "Free", "Pro"]} />
      <tbody className="divide-y divide-line border-y border-line">
        {rows.map((row) => (
          <tr key={row.limit}>
            <th className="py-3 pr-5 text-sm font-normal text-ink-subtle" scope="row">
              {row.limit}
            </th>
            <td className="py-3 pr-5 font-mono text-xs text-ink-muted">{row.free}</td>
            <td className="py-3 font-mono text-xs text-ink-muted">{row.pro}</td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}
