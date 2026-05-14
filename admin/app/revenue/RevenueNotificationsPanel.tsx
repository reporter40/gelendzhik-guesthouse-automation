"use client";

import type { RevenueNotificationsStatus } from "@/lib/adminApi";

type Props = {
  data: RevenueNotificationsStatus | null;
  error?: string | null;
};

export function RevenueNotificationsPanel({ data, error }: Props) {
  if (error) {
    return (
      <div className="aq-card" style={{ borderLeft: "3px solid #ef4444", padding: "20px 24px" }}>
        <div style={{ fontWeight: 600, color: "#ef4444", marginBottom: 6 }}>
          Revenue уведомления — ошибка загрузки
        </div>
        <div style={{ color: "#6b7280", fontSize: 14 }}>{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="aq-card" style={{ padding: "24px", color: "#6b7280", fontSize: 14 }}>
        Загрузка статуса уведомлений…
      </div>
    );
  }

  const { workflow, anti_spam, latest_dashboard, last_execution } = data;

  const antiSpamLabel =
    anti_spam.status === "blocked_by_anti_spam"
      ? "Защита от дубля активна"
      : anti_spam.status === "ready"
        ? "Готово к отправке"
        : "Статус неизвестен";

  const antiSpamColor =
    anti_spam.status === "blocked_by_anti_spam"
      ? "#f59e0b"
      : anti_spam.status === "ready"
        ? "#10b981"
        : "#9ca3af";

  const execLabel =
    last_execution.status === "success"
      ? "Успешно"
      : last_execution.status === "error"
        ? "Ошибка"
        : null;

  const execColor =
    last_execution.status === "success"
      ? "#10b981"
      : last_execution.status === "error"
        ? "#ef4444"
        : null;

  const isEmpty =
    latest_dashboard.today_actions_count === 0 &&
    latest_dashboard.total_gaps === 0;

  return (
    <div className="aq-card" style={{ padding: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>🔔</span>
            <span style={{ fontWeight: 700, fontSize: 17, color: "var(--aq-navy)" }}>
              Revenue уведомления
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 999,
                background: workflow.active ? "#dcfce7" : "#fee2e2",
                color: workflow.active ? "#16a34a" : "#dc2626",
              }}
            >
              {workflow.active ? "активен" : "выключен"}
            </span>
          </div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            Ежедневная сводка владельцу в Telegram
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "right" }}>
          <div>ежедневно в 09:00 МСК</div>
          <div style={{ fontFamily: "monospace", marginTop: 2 }}>06:00 UTC</div>
        </div>
      </div>

      {/* Anti-spam + last sent */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        <InfoCard
          label="Anti-spam"
          value={antiSpamLabel}
          valueColor={antiSpamColor}
          sub={
            anti_spam.next_allowed_at
              ? `следующая: ${fmtTs(anti_spam.next_allowed_at)}`
              : undefined
          }
        />
        <InfoCard
          label="Последняя отправка"
          value={anti_spam.last_sent_at ? fmtTs(anti_spam.last_sent_at) : "нет данных"}
          sub={anti_spam.last_hash ? `hash: ${anti_spam.last_hash}` : undefined}
        />
      </div>

      {/* Dashboard stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        <StatCard label="Действий" value={latest_dashboard.today_actions_count} color="#0B63CE" />
        <StatCard label="🔴 Срочно" value={latest_dashboard.high_count} color="#ef4444" />
        <StatCard label="🟡 Важно" value={latest_dashboard.medium_count} color="#f59e0b" />
        <StatCard label="Окон GAP" value={latest_dashboard.total_gaps} color="#6b7280" />
      </div>

      {/* Hash change indicator */}
      <div style={{ marginBottom: 16, fontSize: 13, color: "#6b7280" }}>
        <span>Текущий hash: </span>
        <code style={{ background: "#f3f4f6", padding: "1px 6px", borderRadius: 4, fontFamily: "monospace" }}>
          {latest_dashboard.current_hash}
        </code>
        {" "}
        {latest_dashboard.hash_changed && (
          <span style={{ color: "#10b981", fontWeight: 600 }}>↑ изменился — уведомление будет отправлено</span>
        )}
        {!latest_dashboard.hash_changed && anti_spam.last_hash && (
          <span style={{ color: "#9ca3af" }}>= совпадает с last_hash</span>
        )}
      </div>

      {/* Last execution */}
      <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
          Последний запуск
        </div>
        {last_execution.status === "unknown" ? (
          <div style={{ fontSize: 13, color: "#9ca3af" }}>
            Execution status недоступен, проверяем по system_vars.
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
            <span
              style={{
                fontWeight: 700,
                color: execColor ?? "#9ca3af",
              }}
            >
              {execLabel}
            </span>
            {last_execution.started_at && (
              <span style={{ color: "#6b7280" }}>
                {fmtTs(last_execution.started_at)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Friendly empty state */}
      {isEmpty && (
        <div style={{
          marginTop: 16,
          padding: "12px 16px",
          background: "#f0f9ff",
          borderRadius: 8,
          fontSize: 13,
          color: "#0369a1",
          borderLeft: "3px solid #0B63CE"
        }}>
          Уведомления включены. Следующая отправка будет утром, если есть новые действия.
        </div>
      )}
    </div>
  );
}

function InfoCard({
  label,
  value,
  valueColor,
  sub,
}: {
  label: string;
  value: string;
  valueColor?: string;
  sub?: string;
}) {
  return (
    <div style={{
      background: "#f9fafb",
      borderRadius: 8,
      padding: "12px 14px",
      border: "1px solid #e5e7eb"
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontWeight: 600, color: valueColor ?? "var(--aq-navy)", fontSize: 14 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, fontFamily: "monospace" }}>{sub}</div>}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div style={{
      background: "#f9fafb",
      borderRadius: 8,
      padding: "10px 12px",
      border: "1px solid #e5e7eb",
      textAlign: "center"
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function fmtTs(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ru-RU", {
      timeZone: "Europe/Moscow",
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }) + " МСК";
  } catch {
    return iso;
  }
}
