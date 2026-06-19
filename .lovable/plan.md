## Por que os lançamentos não aparecem em Receitas/Despesas

Os triggers do banco já estão corretos — eles só criam o lançamento financeiro **quando o registro está marcado como concluído**:

- **Agendamento** (`sync_appointment_to_transactions`): só lança receita do tratamento e despesa do pagamento ao dentista quando `status = 'completed'`. Em qualquer outro status, ele apaga os lançamentos existentes daquele agendamento.
- **Ordem de laboratório** (`sync_order_to_transaction`): só lança a despesa quando `status = 'completed'` e tem valor > 0.
- **Trabalho do funcionário** (`sync_work_record_to_transaction`): lança assim que tem valor; o status só define se é "pago" ou "pendente".

Ou seja: quem está criando agendamentos com status "Agendado/Em andamento" e ordens com status "Pendente/Em produção" **não vê nada no financeiro** — é necessário mudar manualmente para "Concluído" no formulário inteiro, o que é trabalhoso. Foi por isso que parecia que não estava lançando.

## O que vou implementar

### 1. Botão "Concluir procedimento" na lista de Agendamentos (`src/pages/Appointments.tsx`)
- Adicionar um botão verde com ícone de check ao lado das ações existentes (editar/excluir) em cada linha da tabela.
- Aparece somente quando `status !== 'completed'`.
- 1 clique → `UPDATE appointments SET status='completed'` para aquele id, sem abrir modal.
- Se `paid_at` estiver vazio e `payment_method = 'a_vista'`, o trigger já preenche; nada extra no frontend.
- Toast de sucesso "Procedimento concluído e lançado no financeiro" + refresh da lista.

### 2. Botão "Marcar como entregue" na lista de Ordens (`src/pages/Orders.tsx`)
- Adicionar botão verde com ícone de pacote/check em cada linha.
- Aparece somente quando `status !== 'completed'`.
- 1 clique → `UPDATE orders SET status='completed', delivery_date=now()` se ainda não tiver data de entrega.
- Toast "Ordem entregue e despesa lançada no financeiro" + refresh.
- O trigger `sync_order_to_transaction` automaticamente cria a despesa de laboratório.

### 3. Pequena mensagem explicativa
- Adicionar texto curto (cinza, abaixo do título de Agendamentos e Ordens) avisando: "Os lançamentos financeiros só são criados quando o item é marcado como concluído/entregue."

## Detalhes técnicos

- Nenhuma alteração de banco/trigger — eles já fazem o trabalho.
- Apenas dois arquivos editados: `src/pages/Appointments.tsx` e `src/pages/Orders.tsx`.
- Reutiliza o `supabase` client e o `toast` já importados.
- Botão usa `Button` variant `outline` com classe `text-green-600` e ícone `CheckCircle2` (lucide) para concluir e `PackageCheck` para entregar.

## Fora de escopo

- Não vou mexer em valores, métodos de pagamento, ou na lógica de quando o trigger dispara — está funcionando.
- Não vou adicionar o botão dentro do modal de edição (já existe o select de status lá).