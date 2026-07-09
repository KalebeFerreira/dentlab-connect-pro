
## 1. Floating widgets (mobile + desktop)

**File:** `src/components/FloatingWidgets.tsx`
- Remove the standalone floating WhatsApp button entirely from the screen.
- Keep only the Support Assistant (`SupportChatWidget`) as the single floating button.

**File:** `src/components/SupportChatWidget.tsx`
- Make the closed-state bubble more discreet, especially on mobile:
  - Reduce size from `w-14 h-14` → `w-11 h-11` on mobile, `w-12 h-12` on desktop.
  - Reduce icon from `w-7 h-7` → `w-5 h-5`.
  - Lower opacity when idle (`opacity-80 hover:opacity-100`) so it doesn't dominate the screen.
  - Adjust position on mobile (`bottom-3 right-3` on mobile, `bottom-5 right-5` on desktop).
- Inside the open chat panel, add a small secondary action at the bottom of the messages area: **"Falar com atendente no WhatsApp"** link/button that only appears after the user has sent at least 2 messages (i.e. the assistant didn't resolve the doubt on first try). Clicking it navigates to `/ai-agent?connect_whatsapp=1` (same target the removed floating button used), preserving access without cluttering the screen.

## 2. Remove time from all generated reports (keep date only)

Sweep every PDF/HTML report generator and remove `toLocaleTimeString`, `HH:mm`, "às HH:mm", and similar time formatting. Keep the date in `pt-BR` format.

Files to update:
- `supabase/functions/generate-monthly-report-pdf/index.ts`
- `supabase/functions/send-monthly-report-email/index.ts` (footer "Emitido em ... às ...")
- `supabase/functions/generate-financial-pdf/index.ts`
- `supabase/functions/generate-invoice-pdf/index.ts`
- `supabase/functions/generate-receipt-pdf/index.ts`
- `supabase/functions/generate-order-pdf/index.ts`
- `supabase/functions/generate-price-table-pdf/index.ts`
- `supabase/functions/generate-certificate-pdf/index.ts`
- `supabase/functions/generate-service-contract/index.ts`
- `src/lib/pdfGenerator.ts` and `src/lib/reportExport.ts` if they render timestamps
- `src/components/employee/EmployeeMonthlyReportExport.tsx` and `src/components/laboratory/ProductionExport.tsx` if applicable

I'll grep for `toLocaleTimeString` / `getHours` / `às ${` across the report generators and remove those tokens; keep only `toLocaleDateString('pt-BR')`.

## 3. Monthly service reports – no mixing between months

**Files:** `src/components/billing/MonthlyReports.tsx` + `supabase/functions/generate-monthly-report-pdf/index.ts`

Currently a report can include services from adjacent months if the selected date range is loose. Fix:
- In `MonthlyReports.tsx`, when the user selects a month, force the query window to strict `[firstDayOfMonth 00:00, lastDayOfMonth 23:59:59]` of that specific month/year — reject any service whose `service_date` falls outside.
- Pass an explicit `month` + `year` (or ISO range) to the edge function; the edge function will re-filter defensively before rendering, so services from other months can never leak in.
- Group the rendered table strictly under a single "Período: <Mês>/<Ano>" header. If the user later requests multiple months, each month gets its own separated section with its own subtotal and a "Total geral" at the end.

## Notes
- No changes to business logic, subscription gating, or auth — only UI presentation of the widgets and formatting/filtering of reports.
- The WhatsApp connection page (`/ai-agent`) itself remains unchanged; only the always-visible screen button is removed. Access from the assistant chat is preserved as a soft, contextual link.
