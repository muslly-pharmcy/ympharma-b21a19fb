import { useEffect, useState } from "react";
type Quote = {
  hash: string;
  currency: string;
  subtotal: string;
  lines: {
    product_id: string;
    name: string;
    quantity: string;
    unit: string;
    unit_price: string;
    line_total: string;
  }[];
};
type Order = {
  order_id: string;
  version: string;
  state: string;
  coverage_confirmed: boolean;
  confirmation_delayed: boolean;
  expires_at: string;
  quote: Quote;
};
type Operation = { requestId: string; quoteHash: string };
export type ReviewCheckoutPort = {
  quote(): Promise<Quote>;
  submit(v: Operation): Promise<Order>;
  status(requestId: string): Promise<Order>;
  cancel(requestId: string): Promise<Order>;
};
const labels: Record<string, string> = {
  PENDING_REVIEW: "بانتظار مراجعة ERP",
  HELD: "محجوز للمراجعة — لم يُبع أو يُحصّل",
  CANCEL_PENDING: "جارٍ تأكيد الإلغاء",
  EXPIRY_PENDING: "انتهت المهلة — جارٍ تأكيد تحرير الحجز",
  CANCELLED: "أُلغي الطلب",
  EXPIRED: "انتهى الحجز",
  FULFILLED: "عولج في ERP — راجع المستند الأصلي",
  REJECTED: "لم يُقبل الحجز",
};
const finalStates = ["CANCELLED", "EXPIRED", "FULFILLED", "REJECTED"];
function friendly(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/CART_OR_PRICE_CHANGED/.test(message))
    return "تغيّرت السلة أو الأسعار؛ راجع العرض المحدّث قبل التأكيد.";
  if (/INSUFFICIENT|MAPPING|PRODUCT_NOT/.test(message))
    return "تعذر اعتماد أحد الأصناف أو كميته؛ حدّث السلة وراجعها.";
  if (/STALE/.test(message))
    return "بيانات المخزون متأخرة؛ انتظر تحديث ERP ثم أعد المحاولة.";
  if (/CART_EMPTY/.test(message))
    return "السلة فارغة. أضف صنفًا قبل طلب المراجعة.";
  if (/AUTH|401|Unauthorized/.test(message))
    return "انتهت الجلسة. أعد تسجيل الدخول؛ معرّف طلبك محفوظ.";
  return "لم يتأكد إتمام العملية. أعد المحاولة بالطلب نفسه؛ لا تنشئ طلبًا بديلًا.";
}
async function bounded<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(Error("CONFIRMATION_TIMEOUT")), 20000);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
export function ErpManagedCheckout({
  port,
  actorId,
}: {
  port: ReviewCheckoutPort;
  actorId: string;
}) {
  const storage = "erp-review-checkout:" + actorId;
  const [operation, setOperation] = useState<Operation | null>(null),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const s = JSON.parse(sessionStorage.getItem(storage) ?? "null");
      if (
        s &&
        typeof s.requestId === "string" &&
        typeof s.quoteHash === "string"
      )
        setOperation(s);
    } catch {}
    setLoaded(true);
  }, [storage]);
  const [quote, setQuote] = useState<Quote | null>(null),
    [order, setOrder] = useState<Order | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const current = order?.quote ?? quote;
  async function refresh() {
    setError("");
    setBusy(true);
    try {
      if (operation) setOrder(await bounded(port.status(operation.requestId)));
      else setQuote(await bounded(port.quote()));
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!loaded || busy) return;
    let active = true;
    void bounded<Quote | Order>(
      operation ? port.status(operation.requestId) : port.quote(),
    )
      .then((value) => {
        if (active) {
          setError("");
          if (operation) setOrder(value as Order);
          else setQuote(value as Quote);
        }
      })
      .catch((e) => {
        if (active) setError(friendly(e));
      });
    return () => {
      active = false;
    };
  }, [port, operation?.requestId, loaded, busy]);
  useEffect(() => {
    if (!operation || !order || (finalStates.includes(order.state) && order.coverage_confirmed)) return;
    let active = true;
    let inFlight = false;
    const timer = setInterval(() => {
      if (inFlight) return;
      inFlight = true;
      void bounded(port.status(operation.requestId))
        .then((v) => {
          if (active) setOrder(v);
        })
        .catch((e) => {
          if (active) setError(friendly(e));
        }).finally(() => { inFlight = false; });
    }, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [port, operation?.requestId, order?.state, order?.coverage_confirmed]);
  async function submit() {
    if (!current && !operation) return;
    setBusy(true);
    setError("");
    const next = operation ?? {
      requestId: crypto.randomUUID(),
      quoteHash: current!.hash,
    };
    try {
      sessionStorage.setItem(storage, JSON.stringify(next));
    } catch {
      setError(
        "تعذر حفظ معرّف الطلب في المتصفح. اسمح بالتخزين ثم أعد المحاولة. لم يُرسل الطلب.",
      );
      setBusy(false);
      return;
    }
    setOperation(next);
    try {
      setOrder(await bounded(port.submit(next)));
    } catch (e) {
      setError(friendly(e));
      if (
        e instanceof Error &&
        e.message.includes("CART_OR_PRICE_CHANGED_REQUOTE")
      ) {
        setOperation(null);
        sessionStorage.removeItem(storage);
        setQuote(await bounded(port.quote()).catch(() => null));
      }
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    if (!operation) return;
    setBusy(true);
    setError("");
    try {
      setOrder(await bounded(port.cancel(operation.requestId)));
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="mx-auto max-w-3xl space-y-5 rounded-3xl bg-white p-6 text-gray-900 shadow"
      dir="rtl"
      aria-label="طلب مراجعة ERP"
    >
      <h1 className="text-2xl font-bold">مراجعة الطلب وحجزه</h1>
      <p>
        الطلب للمراجعة فقط. لا يتم صرف دواء أو تحصيل مبلغ تلقائيًا. الأسعار
        أدناه معتمدة من الخادم ولا تشمل التوصيل.
      </p>
      {current && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr>
                  <th>الصنف</th>
                  <th>الوحدة</th>
                  <th>الكمية</th>
                  <th>السعر</th>
                  <th>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {current.lines.map((line) => (
                  <tr key={line.product_id}>
                    <td>{line.name}</td>
                    <td>{line.unit}</td>
                    <td>{line.quantity}</td>
                    <td dir="ltr">{line.unit_price}</td>
                    <td dir="ltr">{line.line_total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            قيمة الأصناف للمراجعة:{" "}
            <bdi>
              {current.subtotal} {current.currency}
            </bdi>
          </p>
        </>
      )}
      {order && (
        <div role="status">
          <p>{labels[order.state] ?? "يلزم مراجعة حالة الطلب"}</p>
          <p>
            رقم الطلب: <bdi>{order.order_id}</bdi> · الإصدار:{" "}
            <bdi>{order.version}</bdi>
          </p>
          <p>
            نهاية مهلة الحجز: {new Date(order.expires_at).toLocaleString("ar")}
          </p>
          {!order.coverage_confirmed && order.state !== "PENDING_REVIEW" && (
            <p>لم تؤكد لقطة ERP انعكاس النتيجة على المتاح بعد.</p>
          )}
          {order.confirmation_delayed && (
            <p>
              تأخر تأكيد الاتصال. الطلب محفوظ؛ يمكنك تحديث حالته أو طلب إلغائه
              دون إعادة إنشائه.
            </p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {!order && (
          <button
            className="btn-primary"
            disabled={busy || (!quote && !operation)}
            onClick={() => void submit()}
          >
            {operation ? "إعادة تأكيد الطلب نفسه" : "إرسال طلب المراجعة"}
          </button>
        )}
        <button
          className="rounded-xl border px-4 py-3"
          disabled={busy}
          onClick={() => void refresh()}
        >
          تحديث الحالة والأسعار
        </button>
        {operation && order && !finalStates.includes(order.state) && (
          <button
            className="rounded-xl border px-4 py-3"
            disabled={busy}
            onClick={() => void cancel()}
          >
            طلب إلغاء الحجز
          </button>
        )}
        {order && finalStates.includes(order.state) && (
          <button
            className="rounded-xl border px-4 py-3"
            onClick={() => {
              sessionStorage.removeItem(storage);
              setOperation(null);
              setOrder(null);
              setQuote(null);
            }}
          >
            العودة إلى سلة جديدة
          </button>
        )}
      </div>
      {busy && <p role="status">جارٍ التحقق من الخادم…</p>}
    </section>
  );
}
