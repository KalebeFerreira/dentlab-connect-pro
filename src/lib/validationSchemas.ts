import { z } from "zod";

export const serviceFormSchema = z.object({
  service_name: z.string()
    .trim()
    .min(1, { message: "Nome do serviço é obrigatório" })
    .max(200, { message: "Nome do serviço deve ter no máximo 200 caracteres" }),
  service_value: z.number()
    .positive({ message: "Valor deve ser maior que zero" })
    .max(1000000, { message: "Valor muito alto" }),
  client_name: z.string()
    .trim()
    .max(200, { message: "Nome do cliente deve ter no máximo 200 caracteres" })
    .optional()
    .nullable(),
});

export const transactionFormSchema = z.object({
  transaction_type: z.enum(["receipt", "payment"], {
    required_error: "Tipo de transação é obrigatório",
  }),
  amount: z.number()
    .positive({ message: "Valor deve ser maior que zero" })
    .max(1000000, { message: "Valor muito alto" }),
  description: z.string()
    .trim()
    .max(500, { message: "Descrição deve ter no máximo 500 caracteres" })
    .optional()
    .nullable(),
  status: z.enum(["completed", "pending", "cancelled"]),
  month: z.number().min(1).max(12),
  year: z.number().min(2000).max(2100),
});

export const orderFormSchema = z.object({
  clinic_name: z.string()
    .trim()
    .min(1, { message: "Nome da clínica é obrigatório" })
    .max(200, { message: "Nome da clínica deve ter no máximo 200 caracteres" }),
  dentist_name: z.string()
    .trim()
    .min(1, { message: "Nome do dentista é obrigatório" })
    .max(200, { message: "Nome do dentista deve ter no máximo 200 caracteres" }),
  patient_name: z.string()
    .trim()
    .min(1, { message: "Nome do paciente é obrigatório" })
    .max(200, { message: "Nome do paciente deve ter no máximo 200 caracteres" }),
  work_name: z.string()
    .trim()
    .max(200, { message: "Nome do trabalho deve ter no máximo 200 caracteres" })
    .optional()
    .nullable(),
  work_type: z.string()
    .trim()
    .min(1, { message: "Tipo de trabalho é obrigatório" })
    .max(200, { message: "Tipo de trabalho deve ter no máximo 200 caracteres" }),
  custom_color: z.string()
    .trim()
    .max(100, { message: "Cor deve ter no máximo 100 caracteres" })
    .optional()
    .nullable(),
  teeth_numbers: z.string()
    .trim()
    .min(1, { message: "Números dos dentes são obrigatórios" })
    .max(100, { message: "Números dos dentes devem ter no máximo 100 caracteres" }),
  observations: z.string()
    .trim()
    .max(1000, { message: "Observações devem ter no máximo 1000 caracteres" })
    .optional()
    .nullable(),
  amount: z.number()
    .positive({ message: "Valor deve ser maior que zero" })
    .max(1000000, { message: "Valor muito alto" })
    .optional()
    .nullable(),
  delivery_date: z.string().optional().nullable(),
});

export const priceTableItemSchema = z.object({
  workType: z.string()
    .trim()
    .min(1, { message: "Tipo de trabalho é obrigatório" })
    .max(200, { message: "Tipo de trabalho deve ter no máximo 200 caracteres" }),
  description: z.string()
    .trim()
    .max(500, { message: "Descrição deve ter no máximo 500 caracteres" }),
  price: z.string()
    .regex(/^\d+\.?\d*$/, { message: "Formato de preço inválido" }),
});

export const priceTableSchema = z.object({
  tableName: z.string()
    .trim()
    .min(1, { message: "Nome da tabela é obrigatório" })
    .max(200, { message: "Nome da tabela deve ter no máximo 200 caracteres" }),
  notes: z.string()
    .trim()
    .max(1000, { message: "Notas devem ter no máximo 1000 caracteres" })
    .optional(),
  items: z.array(priceTableItemSchema)
    .min(1, { message: "Adicione pelo menos um item" })
    .max(100, { message: "Máximo de 100 itens por tabela" }),
});
