"use client";

import { useState } from "react";
import type { CandidatesResponse, CompetitorCandidate } from "@/lib/adminApi";
import {
  approveCandidateSourceAction,
  rejectCandidateSourceAction,
} from "./actions";

type Props = {
  data: CandidatesResponse | null;
  error?: string | null;
};

const COHORT_LABELS: Record<string, string> = {
  standard_family_2room:        "Стандарт 4–5 гостей",
  large_family_house_territory: "Крупные 6–8 с территорией",
  gelendzhik_background_market: "Фоновый рынок",
};

export function CompetitorCandidatesPanel({ data, error }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({});

  if (error) {
    return (
      <div className="aq-card" style={{ borderLeft: "3px solid #ef4444", padding: "20px 24px" }}>
        <div style={{ fontWeight: 600, color: "#ef4444", marginBottom: 6 }}>Кандидаты — ошибка загрузки</div>
        <div style={{ color: "#6b7280", fontSize: 14 }}>{error}</div>
      </div>
    );
  }

  const candidates = data?.candidates ?? [];
  const pending = candidates.filter(c => !localStatuses[c.id]);

  return (
    <div className="aq-card" style={{ padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>🔍</span>
            <span style={{ fontWeight: 700, fontSize: 17, color: "var(--aq-navy)" }}>
              Кандидаты в конкуренты
            </span>
            {pending.length > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                background: "#fef9c3", color: "#92400e"
              }}>
                {pending.length} ждут проверки
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            Проверьте кандидатов и назначьте статус до использования в рекомендациях
          </div>
        </div>
      </div>

      {candidates.length === 0 ? (
        <div style={{
          padding: "20px", background: "#f0f9ff", borderRadius: 8,
          fontSize: 13, color: "#0369a1", borderLeft: "3px solid #0B63CE"
        }}>
          Кандидатов нет. Добавьте источники вручную или через форму ниже.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {candidates.map((c) => {
            const localStatus = localStatuses[c.id];
            const isProcessed = !!localStatus;
            const cohortLabel = c.cohort_code ? (COHORT_LABELS[c.cohort_code] ?? c.cohort_code) : "не назначен";
            const aptIds = c.target_apartment_ids ?? [];

            return (
              <div key={c.id} style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: "16px",
                background: isProcessed ? "#f9fafb" : "#fff",
                opacity: isProcessed ? 0.7 : 1
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: isProcessed ? "#9ca3af" : "var(--aq-navy)", marginBottom: 4 }}>
                      {c.name}
                      {isProcessed && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: localStatus === "approved" ? "#10b981" : "#ef4444" }}>
                          {localStatus === "approved" ? "✓ одобрен" : "✗ отклонён"}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "#6b7280" }}>
                      <span>🏠 {c.source_platform}</span>
                      <span>📦 {cohortLabel}</span>
                      {aptIds.length > 0 && <span>🏡 {aptIds.map(id => `№${id}`).join(", ")}</span>}
                      <span>📊 score: {c.similarity_score}</span>
                    </div>
                    {c.data_quality_notes && (
                      <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>
                        {c.data_quality_notes}
                      </div>
                    )}
                    <div style={{ marginTop: 6 }}>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 12, color: "#0B63CE", textDecoration: "underline" }}
                      >
                        {c.url.length > 60 ? c.url.slice(0, 60) + "…" : c.url}
                      </a>
                    </div>
                  </div>

                  {!isProcessed && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 160 }}>
                      <button
                        className="aq-btn"
                        disabled={busyId === c.id}
                        style={{ background: "#10b981", color: "#fff", fontSize: 12 }}
                        onClick={async () => {
                          setBusyId(c.id);
                          try {
                            await approveCandidateSourceAction(c.id);
                            setLocalStatuses(s => ({ ...s, [c.id]: "approved" }));
                          } finally {
                            setBusyId(null);
                          }
                        }}
                      >
                        {busyId === c.id ? "…" : "✓ Одобрить"}
                      </button>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          type="text"
                          placeholder="Причина отклонения"
                          value={rejectReason[c.id] ?? ""}
                          onChange={e => setRejectReason(r => ({ ...r, [c.id]: e.target.value }))}
                          style={{
                            flex: 1, padding: "4px 8px", fontSize: 12,
                            border: "1px solid #e5e7eb", borderRadius: 6
                          }}
                        />
                        <button
                          className="aq-btn"
                          disabled={busyId === c.id}
                          style={{ background: "#ef4444", color: "#fff", fontSize: 12, padding: "4px 8px" }}
                          onClick={async () => {
                            setBusyId(c.id);
                            try {
                              await rejectCandidateSourceAction(c.id, rejectReason[c.id] ?? "не соответствует критериям");
                              setLocalStatuses(s => ({ ...s, [c.id]: "rejected" }));
                            } finally {
                              setBusyId(null);
                            }
                          }}
                        >
                          ✗
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Hint about discovery sources */}
      <div style={{
        marginTop: 16, padding: "10px 14px",
        background: "#f9fafb", borderRadius: 8, fontSize: 12, color: "#6b7280"
      }}>
        <strong>Где искать конкурентов для №50:</strong>{" "}
        gelendzhik.travel, travelandia.ru, sutochno.ru — дома/этажи 6–8 гостей с двором/территорией, 7000–10000 ₽/ночь.
        Добавьте URL вручную через форму ниже.
      </div>
    </div>
  );
}
