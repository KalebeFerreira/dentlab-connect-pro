import { useLocation } from "react-router-dom";
import { SupportChatWidget } from "@/components/SupportChatWidget";

/**
 * Renderiza apenas o widget de suporte (bem discreto) dentro do sistema.
 * Na landing pública nada é renderizado.
 * O acesso ao WhatsApp acontece pelo próprio chat de suporte quando o
 * assistente não resolve a dúvida do usuário.
 */
export const FloatingWidgets = () => {
  const location = useLocation();
  const publicRoutes = ["/", "/auth", "/employee-login"];
  const isPublic = publicRoutes.includes(location.pathname);

  if (isPublic) return null;

  return <SupportChatWidget />;
};
