"use client";

import type { CohortSummaryResponse, AptCoverage } from "@/lib/adminApi";

type Props = {
  data: CohortSummaryResponse | null;
  error?: string | null;
};

const QUALITY_CONFIG = {
  high:   { label: "Высокое",   color: "#10b981", bg: "#dcfce7" },
  medium: { label: "Среднее",   color: "#f59e0b", bg: "#fef9c3" },
  low:    { label: "Низкое",    color: "#ef4444", bg: "#fee2e2" },
};

const APT_NAMES: Record<number, string> = {
  40: "№40",
  41: "№41",
  42: "№42",
  50: "№50",
};

const COHORT_LABELS: Record<string, string> = {
  standard_family_2room:        "Стандарт 4–5 гостей",
  large_family_house_territory: "Крупные 6–8 с территорией",
  gelendzhik_background_market: "Фоновый рынок",
};

export function MarketDataQualityPanel({ data, error }: Props) {
  if (error) {
    return (
      <div className="aq-card" style={{ borderLeft: "3px solid #ef4444", padding: "20px 24px" }}>
        <div style={{ fontWeight: 600, color: "#ef4444", marginBottom: 6 }}>Качество данных — ошибка загрузки</div>
        <div style={{ color: "#6b7280", fontSize: 14 }}>{error}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="aq-card" style={{ padding: "24px", color: "#6b7280", fontSize: 14 }}>
        Загрузка качества рыночных данных…
      </div>
    );
  }

  const overallQ = QUALITY_CONFIG[data.overall_market_quality] ?? QUALITY_CONFIG.low;
  const aptCoverage = data.apt_coverage ?? [];
  // Group by apt_id, pick the non-background cohort row
  const aptMap: Record<number, AptCoverage> = {};
  for (const row of aptCoverage) {
    if (row.cohort_code === "gelendzhik_background_market") continue;
    if (!aptMap[row.apt_id] || row.needs_attention === false) {
      aptMap[row.apt_id] = row;
    }
  }

  return (
    <div className="aq-card" style={{ padding: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>📊</span>
            <span style={{ fontWeight: 700, fontSize: 17, color: "var(--aq-navy)" }}>
              Качество рыночных данных
            </span>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
              background: overallQ.bg, color: overallQ.color
            }}>
              {overallQ.label}
            </span>
          </div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>Покрытие по объектам и кластерам конкурентов</div>
        </div>
        {data.candidates_pending > 0 && (
          <div style={{
            fontSize: 12, color: "#f59e0b", fontWeight: 600,
            padding: "4px 10px", borderRadius: 8, background: "#fef9c3"
          }}>
            {data.candidates_pending} кандидатов ждут проверки
          </div>
        )}
      </div>

      {/* Attention banner for №50 */}
      {data.has_attention_needed && (
        <div style={{
          marginBottom: 16, padding: "12px 16px",
          background: "#fff7ed", borderRadius: 8, borderLeft: "3px solid #f97316"
        }}>
          <div style={{ fontWeight: 600, color: "#c2410c", fontSize: 13, marginBottom: 4 }}>
            ⚠️ Требуется действие
          </div>
          {(data.attention_items ?? []).map((item, i) => (
            <div key={i} style={{ fontSize: 13, color: "#9a3412" }}>
              Объект {APT_NAMES[item.apt_id] ?? `#${item.apt_id}`} ({COHORT_LABELS[item.cohort] ?? item.cohort}):
              недостаточно источников. Добавьте конкурентов крупного формата.
            </div>
          ))}
          <div style={{ fontSize: 12, color: "#c2410c", marginTop: 6 }}>
            Для №50 требуется расширение выборки: дома/этажи 6–8 гостей с территорией.
            Платформы: gelendzhik.travel, travelandia.ru, sutochno.ru
          </div>
        </div>
      )}

      {/* Per-apartment grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        {[40, 41, 42, 50].map((aptId) => {
          const row = aptMap[aptId];
          const q = row
            ? (QUALITY_CONFIG[row.data_quality as keyof typeof QUALITY_CONFIG] ?? QUALITY_CONFIG.low)
            : QUALITY_CONFIG.low;
          const cohortLabel = row ? (COHORT_LABELS[row.cohort_code] ?? row.cohort_code) : "—";
          return (
            <div key={aptId} style={{
              background: "#f9fafb", borderRadius: 10, padding: "14px 12px",
              border: `1px solid ${row?.needs_attention ? "#fed7aa" : "#e5e7eb"}`
            }}>
              <div style={{ fontWeight: 700, color: "var(--aq-navy)", fontSize: 16, marginBottom: 4 }}>
                №{aptId}
              </div>
              <div style={{
                fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 999, display: "inline-block",
                background: q.bg, color: q.color, marginBottom: 8
              }}>
                {q.label}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{cohortLabel}</div>
              {row ? (
                <>
                  <div style={{ fontSize: 12, color: "#374151" }}>
                    Источников: <strong>{row.active_count}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: "#374151" }}>
                    Наблюдений: <strong>{row.total_obs}</strong>
                  </div>
                  {row.market_median && (
                    <div style={{ fontSize: 12, color: "#0B63CE", fontWeight: 600, marginTop: 4 }}>
                      Медиана: {Math.round(row.market_median).toLocaleString("ru-RU")} ₽
                    </div>
                  )}
                  {row.needs_attention && (
                    <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4, fontWeight: 600 }}>
                      ⚠ нужны источники
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 12, color: "#9ca3af" }}>Нет данных</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Cohort table */}
      <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
          Кластеры конкурентов
        </div>
        <div className="aq-table-wrap">
          <table className="aq-table">
            <thead>
              <tr>
                <th>Кластер</th>
                <th>Объекты</th>
                <th>Источников</th>
                <th>Наблюдений</th>
                <th>Медиана</th>
                <th>Качество</th>
              </tr>
            </thead>
            <tbody>
              {(data.cohorts ?? []).map((c) => {
                const dq = QUALITY_CONFIG[(c as { data_quality?: string }).data_quality as keyof typeof QUALITY_CONFIG ?? "low"] ?? QUALITY_CONFIG.low;
                const aptIds = (c.target_apartment_ids ?? []).filter(id => id !== undefined);
                return (
                  <tr key={c.code}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>{c.code}</div>
                    </td>
                    <td>
                      {aptIds.length > 0
                        ? aptIds.map(id => `№${id}`).join(", ")
                        : "—"
                      }
                    </td>
                    <td style={{ fontWeight: 600 }}>{c.active_sources}</td>
                    <td>{c.observations_count}</td>
                    <td style={{ fontWeight: 600, color: "#0B63CE" }}>
                      {c.market_median ? `${Math.round(c.market_median).toLocaleString("ru-RU")} ₽` : "—"}
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                        background: dq.bg, color: dq.color
                      }}>
                        {dq.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
