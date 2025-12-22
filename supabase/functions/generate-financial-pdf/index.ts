import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  description: string;
  status: string;
  month: number;
  year: number;
  created_at: string;
}

interface RequestBody {
  transactions: Transaction[];
  month: number;
  year: number;
  companyInfo?: {
    company_name?: string;
    email?: string;
    phone?: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transactions, month, year, companyInfo }: RequestBody = await req.json();

    if (!transactions || !month || !year) {
      throw new Error('Dados incompletos');
    }

    console.log(`Gerando PDF financeiro: ${month}/${year} com ${transactions.length} transações`);

    // Calculate totals
    const income = transactions
      .filter(t => t.transaction_type === 'receipt' && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);

    const expense = transactions
      .filter(t => t.transaction_type === 'payment' && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);

    const pending = transactions
      .filter(t => t.status === 'pending')
      .reduce((sum, t) => sum + t.amount, 0);

    const profit = income - expense;

    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const monthName = monthNames[month - 1];

    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(value);
    };

    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('pt-BR');
    };

    // Separate transactions by type
    const incomeTransactions = transactions.filter(t => t.transaction_type === 'receipt');
    const expenseTransactions = transactions.filter(t => t.transaction_type === 'payment');

    // Generate transactions HTML
    const generateTransactionRows = (txs: Transaction[], type: 'income' | 'expense') => {
      if (txs.length === 0) {
        return `<tr><td colspan="4" style="padding: 12px; text-align: center; color: #666;">Nenhuma ${type === 'income' ? 'receita' : 'despesa'} registrada</td></tr>`;
      }
      
      return txs.map(t => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${formatDate(t.created_at)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${t.description || '-'}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">
            <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; background: ${t.status === 'completed' ? '#dcfce7' : '#fef3c7'}; color: ${t.status === 'completed' ? '#166534' : '#92400e'};">
              ${t.status === 'completed' ? 'Confirmado' : 'Pendente'}
            </span>
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: 600; color: ${type === 'income' ? '#16a34a' : '#dc2626'};">
            ${formatCurrency(t.amount)}
          </td>
        </tr>
      `).join('');
    };

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Relatório Financeiro - ${monthName} ${year}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Inter', sans-serif;
          color: #1f2937;
          background: #fff;
          padding: 40px;
        }
        
        .header {
          text-align: center;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 2px solid #1c4587;
        }
        
        .logo {
          font-size: 28px;
          font-weight: 700;
          color: #1c4587;
          margin-bottom: 8px;
        }
        
        .report-title {
          font-size: 20px;
          color: #374151;
          margin-bottom: 4px;
        }
        
        .report-period {
          font-size: 14px;
          color: #6b7280;
        }
        
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 40px;
        }
        
        .summary-card {
          padding: 20px;
          border-radius: 12px;
          text-align: center;
        }
        
        .summary-card.income {
          background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
        }
        
        .summary-card.expense {
          background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
        }
        
        .summary-card.profit {
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
        }
        
        .summary-card.pending {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
        }
        
        .summary-label {
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
          color: #6b7280;
          margin-bottom: 8px;
        }
        
        .summary-value {
          font-size: 24px;
          font-weight: 700;
        }
        
        .summary-card.income .summary-value { color: #16a34a; }
        .summary-card.expense .summary-value { color: #dc2626; }
        .summary-card.profit .summary-value { color: #2563eb; }
        .summary-card.pending .summary-value { color: #d97706; }
        
        .section {
          margin-bottom: 32px;
        }
        
        .section-title {
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 2px solid #e5e7eb;
        }
        
        .section-title.income { border-color: #16a34a; }
        .section-title.expense { border-color: #dc2626; }
        
        table {
          width: 100%;
          border-collapse: collapse;
          background: #fff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        th {
          background: #f3f4f6;
          padding: 12px;
          text-align: left;
          font-weight: 600;
          font-size: 12px;
          text-transform: uppercase;
          color: #6b7280;
        }
        
        th:last-child {
          text-align: right;
        }
        
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #9ca3af;
          font-size: 12px;
        }
        
        @media print {
          body { padding: 20px; }
          .summary-grid { grid-template-columns: repeat(2, 1fr); }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">${companyInfo?.company_name || 'Essência Dental Lab'}</div>
        <div class="report-title">Relatório Financeiro</div>
        <div class="report-period">${monthName} de ${year}</div>
      </div>
      
      <div class="summary-grid">
        <div class="summary-card income">
          <div class="summary-label">Receitas</div>
          <div class="summary-value">${formatCurrency(income)}</div>
        </div>
        <div class="summary-card expense">
          <div class="summary-label">Despesas</div>
          <div class="summary-value">${formatCurrency(expense)}</div>
        </div>
        <div class="summary-card profit">
          <div class="summary-label">Lucro Líquido</div>
          <div class="summary-value">${formatCurrency(profit)}</div>
        </div>
        <div class="summary-card pending">
          <div class="summary-label">Pendentes</div>
          <div class="summary-value">${formatCurrency(pending)}</div>
        </div>
      </div>
      
      <div class="section">
        <h2 class="section-title income">📈 Receitas (${incomeTransactions.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th style="text-align: center;">Status</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            ${generateTransactionRows(incomeTransactions, 'income')}
          </tbody>
        </table>
      </div>
      
      <div class="section">
        <h2 class="section-title expense">📉 Despesas (${expenseTransactions.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th style="text-align: center;">Status</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            ${generateTransactionRows(expenseTransactions, 'expense')}
          </tbody>
        </table>
      </div>
      
      <div class="footer">
        <p>Relatório gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
        <p>${companyInfo?.email ? `${companyInfo.email} | ` : ''}${companyInfo?.phone || ''}</p>
      </div>
    </body>
    </html>
    `;

    return new Response(
      JSON.stringify({
        success: true,
        html: html,
        filename: `relatorio-financeiro-${month}-${year}.html`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro ao gerar PDF financeiro:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
