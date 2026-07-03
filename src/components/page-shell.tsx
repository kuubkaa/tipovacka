import { SiteHeader, type ActivePage } from "@/components/site-header";
import { PAGE_WIDTH } from "@/lib/layout";

export function PageShell({
  title,
  description,
  active,
  children,
}: {
  title: string;
  description?: string;
  active?: ActivePage;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col bg-slate-50 text-slate-900">
      <SiteHeader active={active} />

      <main className={`mx-auto w-full ${PAGE_WIDTH} flex-1 px-4 py-8 sm:px-6 sm:py-10`}>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && (
          <p className="mt-2 text-base text-slate-600">{description}</p>
        )}
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}
