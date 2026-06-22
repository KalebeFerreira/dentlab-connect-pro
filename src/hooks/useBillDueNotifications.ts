import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "./usePushNotifications";
import { toast } from "sonner";
import { differenceInDays, parseISO } from "date-fns";

/**
 * Avisa o usuário sobre contas a vencer:
 *  - 1 dia antes do vencimento
 *  - no dia
 *  - quando vencidas
 * Roda ao montar e a cada 1h.
 */
export const useBillDueNotifications = (userId: string | undefined) => {
  const { sendNotification, permission } = usePushNotifications();

  useEffect(() => {
    if (!userId) return;

    const notified = new Set<string>();

    const check = async () => {
      try {
        const { data, error } = await supabase
          .from("financial_transactions")
          .select("id, description, amount, due_date, paid_at, transaction_type")
          .eq("user_id", userId)
          .is("paid_at", null)
          .not("due_date", "is", null);
        if (error) throw error;

        const now = new Date();
        (data || []).forEach((row: any) => {
          if (!row.due_date) return;
          const days = differenceInDays(parseISO(row.due_date), now);
          if (days > 1) return;

          const desc = String(row.description || "").replace(/\s*\[(MANUAL-REC|MANUAL-DESP|AGD-REC|AGD-DESP|TRAB|ORD):[^\]]+\]/g, "").trim();
          const valor = `R$ ${Number(row.amount || 0).toFixed(2)}`;
          let title = "";
          let body = "";
          if (days === 1) {
            title = "⏰ Conta vence amanhã";
            body = `${desc} — ${valor}`;
          } else if (days === 0) {
            title = "🚨 Conta vence hoje";
            body = `${desc} — ${valor}`;
          } else {
            title = "⚠️ Conta atrasada";
            body = `${desc} — ${valor} (${Math.abs(days)} dia(s))`;
          }

          const tag = `bill-${row.id}-${days}`;
          if (notified.has(tag)) return;
          notified.add(tag);

          toast(title, { description: body });
          if (permission === "granted") {
            sendNotification(title, { body, tag, requireInteraction: days <= 0 });
          }
        });
      } catch (e) {
        console.error("[useBillDueNotifications]", e);
      }
    };

    check();
    const interval = setInterval(check, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userId, permission, sendNotification]);
};
