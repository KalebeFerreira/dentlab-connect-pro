## Diagnóstico: por que "sumiram" as alterações

As mudanças de ontem estão **todas no código e ativas** no projeto:

- `src/pages/Financial.tsx` já renderiza:
  - aba **Relatórios** → `<PaymentTypeReports />` (À Vista / Mensalistas com semanal, quinzenal, mensal, anual + exportação PDF/CSV/Imprimir)
  - aba **Agendamentos** → `<AppointmentsFinancialTab />` (contas a vencer, vencidas, pagas, botão "Nova conta a vencer", switch pago/não pago, edição/exclusão)
- `src/App.tsx` monta `<BillNotifier />` (avisos 1 dia antes do vencimento)
- Componentes existem: `AppointmentsFinancialTab.tsx`, `PaymentTypeReports.tsx`, `AddBillDueDialog.tsx`, `useBillDueNotifications.ts`

**Por que no seu dispositivo (celular/PWA) parece que sumiu:** o app é um PWA com Service Worker (`dev-dist/sw.js` + `public/manifest.json`). O SW guardou em cache a versão antiga e segue servindo ela offline-first, mesmo após você "atualizar". Em iOS isso é especialmente persistente.

## O que vou fazer (somente correção do problema real — sem reescrever as features que já existem)

### 1. Forçar atualização do PWA quando houver nova versão

Adicionar lógica de "update available" no boot do app:
- Registrar o SW com `registerSW({ immediate: true, onNeedRefresh })` (do `virtual:pwa-register`).
- Quando houver nova versão, exibir um toast "Nova versão disponível — Atualizar" que chama `updateSW(true)` (skip waiting + reload).
- Em paralelo: na montagem do `App`, se `navigator.serviceWorker.controller` existir, chamar `registration.update()` para checar nova versão a cada sessão.

Arquivo: **editar** `src/main.tsx` (registrar SW com auto-update) e **criar** `src/components/PWAUpdatePrompt.tsx` (toast de atualização).

### 2. Bumpar a versão do cache do manifest/SW

Editar `public/manifest.json` (campo `version` ou query no `start_url`) e garantir que o `vite-plugin-pwa` esteja em modo `autoUpdate` no `vite.config.ts` para invalidar o cache antigo.

### 3. Verificação visual

Após o deploy, abrir `/financial` no celular e confirmar:
- aba **Relatórios** mostrando sub-abas "À Vista" e "Mensalistas" com seletor Semanal/Quinzenal/Mensal/Anual + botões Exportar PDF / Excel / Imprimir + card "Total Recebido" consolidado.
- aba **Agendamentos** mostrando cards (A vencer / Vencidas / Pagas / Previsto), botão **+ Nova conta a vencer**, lista de contas com switch **Pago/Não pago**, editar e excluir.

### Sobre o que você descreveu como "quero adicionar"

Tudo já existe no código atual (foi feito ontem). Se após a atualização do PWA ainda faltar algo específico, ajusto pontualmente — **não vou recriar** os componentes para evitar perder o que já está pronto.

### Passo manual para destravar agora (enquanto o fix sobe)

No celular: **fechar o app PWA → Configurações do navegador → Limpar dados do site** do domínio do app → reabrir. Isso descarta o SW antigo imediatamente.

### Arquivos
- editar `src/main.tsx`
- criar `src/components/PWAUpdatePrompt.tsx`
- editar `vite.config.ts` (garantir `registerType: 'autoUpdate'`)
- editar `public/manifest.json` (bump de versão)

Sem mudanças de schema, sem novas dependências (vite-plugin-pwa já está no projeto).