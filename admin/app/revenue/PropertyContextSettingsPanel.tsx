"use client";

import { useCallback, useMemo, useState, useTransition, type FormEvent } from "react";
import {
  reloadPropertyContextSettingsAction,
  savePropertyContextSettingsFieldsAction,
} from "./propertyContextActions";
import { normalizePropertyContextMapFromJsonText } from "@/lib/property-context-settings";

type Props = {
  initialMapText: string;
  initialDefault: string;
  serverLoadError: string | null;
};

export function PropertyContextSettingsPanel({
  initialMapText,
  initialDefault,
  serverLoadError,
}: Props) {
  const [mapJson, setMapJson] = useState(initialMapText);
  const [defCtx, setDefCtx] = useState(initialDefault);
  const [clientErr, setClientErr] = useState<string | null>(null);
  const [serverErr, setServerErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reloadMsg, setReloadMsg] = useState<string | null>(null);
  const [pendingSave, startSave] = useTransition();
  const [pendingReload, startReload] = useTransition();

  const previewOk = useMemo(() => {
    const pr = normalizePropertyContextMapFromJsonText(mapJson);
    return pr.ok ? pr.map : null;
  }, [mapJson]);

  const serverHint = useMemo(
    () =>
      serverLoadError
        ? `При открытии страницы не удалось загрузить текущие значения: ${serverLoadError}. Нажмите «Загрузить с сервера».`
        : null,
    [serverLoadError],
  );

  const onReload = useCallback(() => {
    setReloadMsg(null);
    setClientErr(null);
    setServerErr(null);
    startReload(async () => {
      const r = await reloadPropertyContextSettingsAction();
      if (r.ok && r.mapText != null) {
        setMapJson(r.mapText);
        setDefCtx(r.defaultContext ?? "");
        setReloadMsg("Загружено с сервера");
      } else {
        setServerErr(r.error ?? "Не удалось загрузить");
      }
    });
  }, []);

  const onSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      setSuccess(null);
      setServerErr(null);
      setReloadMsg(null);
      const pr = normalizePropertyContextMapFromJsonText(mapJson);
      if (!pr.ok) {
        setClientErr(pr.error);
        return;
      }
      setClientErr(null);
      startSave(async () => {
        const res = await savePropertyContextSettingsFieldsAction(mapJson, defCtx);
        if (res.ok) setSuccess(res.message ?? "Сохранено");
        else setServerErr(res.error ?? "Ошибка");
      });
    },
    [mapJson, defCtx],
  );

  return (
    <section
      id="property-context-settings"
      className="aq-section scroll-mt-4 mb-6 rounded-2xl border px-5 py-4"
      style={{ background: "#FAFCFF", borderColor: "#CDE4F5" }}
    >
      <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: "#0B63CE" }}>
        Direct offer · Property context
      </h2>
      <p className="text-xs text-slate-600 mt-1 mb-3 max-w-3xl">
        Карта <code className="bg-slate-100 px-1 rounded">apartment_id → бренд</code> и fallback{" "}
        <code className="bg-slate-100 px-1">default_property_context</code>. Запись идёт через Admin API (
        PCS), в БД сохраняется только нормализованный JSON.
      </p>

      {serverHint && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-2">
          {serverHint}
        </p>
      )}

      {success && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2 mb-2">
          ✓ {success}
        </p>
      )}
      {(clientErr || serverErr) && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 mb-2">
          {clientErr ?? serverErr}
        </p>
      )}
      {reloadMsg && !serverErr && (
        <p className="text-xs text-emerald-700 mb-2">{reloadMsg}</p>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          onClick={onReload}
          disabled={pendingReload}
          className="aq-btn aq-btn-ghost text-xs"
        >
          {pendingReload ? "Загрузка…" : "Загрузить с сервера"}
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            property_context_map (JSON-объект)
          </label>
          <textarea
            value={mapJson}
            onChange={(e) => {
              setMapJson(e.target.value);
              setClientErr(null);
              setSuccess(null);
              setReloadMsg(null);
            }}
            rows={8}
            className="w-full font-mono text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder={'{\n  "50": "Акваторинг"\n}'}
            spellCheck={false}
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Не массив. Пустые ключи/значения отбрасываются. Числа в значениях приводятся к строке.
          </p>
        </div>

        <div className="max-w-md">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            default_property_context
          </label>
          <input
            type="text"
            value={defCtx}
            onChange={(e) => {
              setDefCtx(e.target.value);
              setSuccess(null);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Акваторинг"
          />
        </div>

        {previewOk !== null && (
          <p className="text-[11px] text-slate-500 font-mono break-all">
            payload: {JSON.stringify({ property_context_map: previewOk, default: defCtx.trim() })}
          </p>
        )}

        <button
          type="submit"
          disabled={pendingSave || previewOk === null}
          className="aq-btn text-sm"
        >
          {pendingSave ? "Сохранение…" : "Сохранить"}
        </button>
      </form>
    </section>
  );
}
