import { adminApi, type TemplateRow } from "@/lib/adminApi";
import { requireAuth } from "@/lib/session";
import Nav from "@/components/Nav";

function groupByChannel(list: TemplateRow[]) {
  const guest: TemplateRow[] = [];
  const owner: TemplateRow[] = [];
  for (const t of list) {
    if (t.channel === "guest") guest.push(t);
    else owner.push(t);
  }
  guest.sort((a, b) => a.key.localeCompare(b.key));
  owner.sort((a, b) => a.key.localeCompare(b.key));
  return { guest, owner };
}

function TemplateCard({ t }: { t: TemplateRow }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        <code className="rounded bg-gray-100 px-2 py-0.5 text-sm font-medium text-gray-900">
          {t.key}
        </code>
        <span className="text-xs text-gray-500">{t.lang}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            t.active
              ? "bg-green-100 text-green-800"
              : "bg-gray-200 text-gray-600"
          }`}
        >
          {t.active ? "active" : "off"}
        </span>
      </div>
      <p className="mb-2 text-xs text-gray-500">
        updated: {t.updated_at ?? "—"}
      </p>
      <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md bg-gray-50 p-3 text-sm text-gray-800">
        {t.body}
      </pre>
    </article>
  );
}

function ChannelSection({
  title,
  items,
}: {
  title: string;
  items: TemplateRow[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((t) => (
          <TemplateCard key={t.key} t={t} />
        ))}
      </div>
    </section>
  );
}

export default async function TemplatesPage() {
  await requireAuth();

  let error: string | null = null;
  let templates: TemplateRow[] = [];

  try {
    templates = await adminApi("templates");
  } catch (e) {
    error =
      e instanceof Error
        ? e.message
        : "Не удалось загрузить шаблоны сообщений.";
  }

  const { guest, owner } = groupByChannel(templates);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="mb-2 text-2xl font-semibold text-gray-900">
          Шаблоны сообщений
        </h1>
        <p className="mb-6 text-sm text-amber-800">
          Редактирование появится на этапе A4 — сейчас только просмотр
          (read-only).
        </p>
        {error && (
          <div
            className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </div>
        )}
        <div className="space-y-10">
          <ChannelSection title="Канал: guest" items={guest} />
          <ChannelSection title="Канал: owner" items={owner} />
        </div>
      </main>
    </>
  );
}
