// Gera payload PIX estático (BR Code) conforme padrão BACEN/EMV
// https://www.bcb.gov.br/estabilidadefinanceira/pix

function crc16(payload: string): string {
  let crc = 0xffff;
  const polynomial = 0x1021;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ polynomial : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function field(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function sanitize(text: string, max: number): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .toUpperCase()
    .slice(0, max);
}

export type PixKeyType = "phone" | "cpf" | "cnpj" | "email" | "random";

export function formatPixKey(key: string, type: PixKeyType): string {
  const digits = key.replace(/\D/g, "");
  switch (type) {
    case "phone":
      return digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
    case "cpf":
    case "cnpj":
      return digits;
    case "email":
      return key.trim().toLowerCase();
    case "random":
      return key.trim().toLowerCase();
  }
}

export interface PixPayload {
  key: string;
  keyType: PixKeyType;
  merchantName: string;
  merchantCity: string;
  amount?: number;
  description?: string;
  txid?: string;
}

export function generatePixPayload({
  key,
  keyType,
  merchantName,
  merchantCity,
  amount,
  description,
  txid = "***",
}: PixPayload): string {
  const formattedKey = formatPixKey(key, keyType);

  // Merchant Account Information (ID 26)
  let merchantAccount = field("00", "br.gov.bcb.pix") + field("01", formattedKey);
  if (description) {
    const descSanitized = sanitize(description, 50);
    if (descSanitized) merchantAccount += field("02", descSanitized);
  }

  // Additional Data Field (ID 62)
  const additionalData = field("05", txid.slice(0, 25));

  let payload = "";
  payload += field("00", "01"); // Payload Format Indicator
  payload += field("26", merchantAccount);
  payload += field("52", "0000"); // Merchant Category Code
  payload += field("53", "986"); // Currency BRL
  if (amount && amount > 0) {
    payload += field("54", amount.toFixed(2));
  }
  payload += field("58", "BR"); // Country
  payload += field("59", sanitize(merchantName, 25) || "PAGADOR");
  payload += field("60", sanitize(merchantCity, 15) || "BRASIL");
  payload += field("62", additionalData);
  payload += "6304"; // CRC placeholder

  return payload + crc16(payload);
}
