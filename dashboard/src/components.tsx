import { useEffect, useRef, useState, type PropsWithChildren, type ReactNode } from "react";
import {
  BeakerIcon,
  BoltIcon,
  ChevronRightIcon,
  CircleStackIcon,
  ExclamationTriangleIcon,
  HomeIcon,
  QueueListIcon,
} from "@heroicons/react/16/solid";

type StatusTone = "success" | "warning" | "danger" | "primary" | "neutral";

const statusToneClasses: Record<StatusTone, string> = {
  success: "border-success/20 bg-success-soft text-success",
  warning: "border-warning/20 bg-warning-soft text-warning",
  danger: "border-danger/20 bg-danger-soft text-danger",
  primary: "border-primary/20 bg-primary-soft text-primary",
  neutral: "border-border bg-canvas text-muted",
};

export function StatusBadge({ children, tone = "neutral" }: PropsWithChildren<{ tone?: StatusTone }>) {
  return (
    <span className={`inline-flex min-h-7 items-center border px-2 text-sm/5 font-medium ${statusToneClasses[tone]} rounded-control`}>
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-balance text-[1.75rem]/9 font-semibold tracking-tight text-ink">{title}</h1>
        <p className="mt-2 max-w-[72ch] text-pretty text-base/6 text-muted">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Notice({
  title,
  children,
  tone = "warning",
}: PropsWithChildren<{ title: string; tone?: "warning" | "danger" | "primary" }>) {
  const colors = {
    warning: "border-warning/25 bg-warning-soft text-warning",
    danger: "border-danger/25 bg-danger-soft text-danger",
    primary: "border-primary/25 bg-primary-soft text-primary",
  } as const;
  return (
    <section className={`rounded-panel border p-4 ${colors[tone]}`} aria-live={tone === "danger" ? "assertive" : "polite"}>
      <h2 className="text-base/6 font-semibold">{title}</h2>
      <div className="mt-1 text-base/6 text-ink">{children}</div>
    </section>
  );
}

export function LoadingPanel({ label }: { label: string }) {
  return (
    <section className="panel p-5" aria-busy="true" aria-live="polite">
      <p className="text-base/6 text-muted">{label}</p>
      <div className="mt-4 h-3 w-3/4 rounded bg-border" />
      <div className="mt-3 h-3 w-1/2 rounded bg-border" />
    </section>
  );
}

export function ReadFailure({
  message,
  correlationId,
  onRetry,
}: {
  message: string;
  correlationId: string | null;
  onRetry: () => void;
}) {
  return (
    <Notice title="Could not read this information" tone="danger">
      <p>{message}</p>
      {correlationId ? <p className="mt-2 font-mono text-sm/5" translate="no">Reference: {correlationId}</p> : null}
      <button className="secondary-action mt-4 px-3 text-sm/5" type="button" onClick={onRetry}>
        Retry read
      </button>
    </Notice>
  );
}

const navItems = [
  { href: "/", label: "System", icon: HomeIcon },
  { href: "/trials", label: "Trials", icon: QueueListIcon },
  { href: "/attention", label: "Attention", icon: ExclamationTriangleIcon },
  { href: "/experiments", label: "Experiments", icon: BeakerIcon },
  { href: "/recovery-cases", label: "Recovery cases", icon: CircleStackIcon },
] as const;

function Navigation({ pathname, attentionCount, onNavigate }: { pathname: string; attentionCount: number | null; onNavigate?: () => void }) {
  return (
    <nav aria-label="Primary navigation" className="flex flex-col gap-1">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <a
            key={href}
            href={href}
            className={`flex min-h-11 items-center gap-2 rounded-control px-3 text-sm/5 font-medium no-underline ${
              active ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface hover:text-ink"
            }`}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0 fill-current" />
            <span className="min-w-0">{label}</span>
            {label === "Attention" && attentionCount ? (
              <span className="ml-auto rounded-full bg-warning-soft px-1.5 font-mono text-sm/5 text-warning tabular-nums" aria-label={`${attentionCount} attention records`}>
                {attentionCount}
              </span>
            ) : null}
          </a>
        );
      })}
    </nav>
  );
}

function MobileNavigation({ pathname, attentionCount }: { pathname: string; attentionCount: number | null }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => () => dialogRef.current?.close(), []);
  const close = () => dialogRef.current?.close();
  const show = () => {
    dialogRef.current?.showModal();
    setOpen(true);
  };
  return (
    <>
      <button className="secondary-action px-3 text-sm/5" type="button" aria-haspopup="dialog" aria-expanded={open} onClick={show}>Menu</button>
      <dialog
        ref={dialogRef}
        className="mobile-menu m-0 ml-auto h-dvh w-[min(20rem,calc(100vw-2rem))] border-0 bg-surface p-5 text-ink"
        aria-label="Navigation menu"
        onClose={() => setOpen(false)}
        onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
          <span className="text-base/6 font-semibold">Navigate</span>
          <button className="secondary-action px-3 text-sm/5" type="button" onClick={close}>Close</button>
        </div>
        <div className="mt-4"><Navigation pathname={pathname} attentionCount={attentionCount} onNavigate={close} /></div>
      </dialog>
    </>
  );
}

export function Shell({
  pathname,
  attentionCount,
  children,
}: PropsWithChildren<{ pathname: string; attentionCount: number | null }>) {
  return (
    <div className="isolate min-h-dvh bg-canvas antialiased">
      <a href="#main-content" className="sr-only focus:not-sr-only focus-ring absolute left-4 top-4 z-50 rounded-control bg-surface px-3 py-2 text-sm/5 text-ink">
        Skip to main content
      </a>
      <aside className="fixed inset-y-0 left-0 hidden w-[13.5rem] border-r border-border bg-canvas p-5 min-[1200px]:block">
        <a href="/" className="mb-8 flex items-center gap-2 text-ink no-underline" aria-label="Homepage">
          <BoltIcon aria-hidden="true" className="size-4 shrink-0 fill-primary" />
          <span className="text-base/6 font-semibold">Backend Ops</span>
        </a>
        <Navigation pathname={pathname} attentionCount={attentionCount} />
        <p className="absolute bottom-5 left-5 right-5 text-sm/5 text-muted">Local dissertation testbed</p>
      </aside>
      <header className="sticky top-0 z-20 border-b border-border bg-canvas px-5 py-3 min-[1200px]:hidden">
        <div className="flex items-center justify-between gap-3">
          <a href="/" className="flex items-center gap-2 text-ink no-underline" aria-label="Homepage">
            <BoltIcon aria-hidden="true" className="size-4 shrink-0 fill-primary" />
            <span className="text-base/6 font-semibold">Backend Ops</span>
          </a>
          <MobileNavigation pathname={pathname} attentionCount={attentionCount} />
        </div>
      </header>
      <main id="main-content" className="min-w-0 p-5 sm:p-6 min-[1200px]:ml-[13.5rem] min-[1200px]:p-8" tabIndex={-1}>
        <div className="mx-auto max-w-[72.5rem]">{children}</div>
      </main>
    </div>
  );
}

export function DetailLink({ href, children }: PropsWithChildren<{ href: string }>) {
  return (
    <a className="inline-flex min-h-11 items-center gap-1 text-sm/5 font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary" href={href}>
      {children}
      <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 fill-current" />
    </a>
  );
}
