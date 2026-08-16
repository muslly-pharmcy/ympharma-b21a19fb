import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type AuthorizationDetails = {
  client?: { name?: string; client_uri?: string } | null;
  redirect_url?: string;
  redirect_to?: string;
  scope?: string;
  scopes?: string[];
};

// Local typed wrapper for the beta supabase.auth.oauth namespace.
type OAuthApi = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
};

export function oauth(): OAuthApi {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.auth as any).oauth as OAuthApi;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { redirect: next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main dir="rtl" style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>تعذّر تحميل طلب التفويض</h1>
      <p>{String((error as Error)?.message ?? error)}</p>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("لم يُرجع خادم التفويض عنوان توجيه.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "التطبيق الخارجي";

  return (
    <main
      dir="rtl"
      style={{
        maxWidth: 480,
        margin: "48px auto",
        padding: 32,
        fontFamily: "Cairo, system-ui, sans-serif",
        border: "1px solid #E5E7EB",
        borderRadius: 16,
        background: "#fff",
      }}
    >
      <h1 style={{ fontSize: 22, marginBottom: 8, color: "#005D4F" }}>
        ربط {clientName} بحسابك في MUSLLY
      </h1>
      <p style={{ color: "#374151", lineHeight: 1.7 }}>
        سيتمكّن <strong>{clientName}</strong> من استخدام أدوات هذا التطبيق بالنيابة عنك مع
        احترام صلاحيّاتك (RLS) في قاعدة البيانات.
      </p>
      <p style={{ color: "#6B7280", fontSize: 13, marginTop: 12 }}>
        هذا لا يتجاوز صلاحيّات التطبيق أو سياسات الحماية الخلفية.
      </p>
      {error && (
        <p role="alert" style={{ color: "#B91C1C", marginTop: 16 }}>
          {error}
        </p>
      )}
      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <button
          disabled={busy}
          onClick={() => decide(true)}
          style={{
            flex: 1,
            padding: "12px 16px",
            background: "#005D4F",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontWeight: 600,
            cursor: busy ? "wait" : "pointer",
          }}
        >
          {busy ? "..." : "الموافقة والربط"}
        </button>
        <button
          disabled={busy}
          onClick={() => decide(false)}
          style={{
            flex: 1,
            padding: "12px 16px",
            background: "#fff",
            color: "#374151",
            border: "1px solid #D1D5DB",
            borderRadius: 10,
            fontWeight: 600,
            cursor: busy ? "wait" : "pointer",
          }}
        >
          رفض
        </button>
      </div>
    </main>
  );
}
