import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

interface MessageHistoryRecord {
  id: string;
  message_type: string;
  message_content: string;
  sent_at: string;
  status: string;
  appointments?: {
    appointment_date: string;
    type: string;
  } | null;
}

interface MessageHistoryProps {
  patientId: string;
  patientName: string;
}

const messageTypeLabels: Record<string, string> = {
  appointment_reminder: "Lembrete de Agendamento",
  appointment_confirmation: "Confirmação de Agendamento",
  general: "Mensagem Geral",
};

export const MessageHistory = ({ patientId, patientName }: MessageHistoryProps) => {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<MessageHistoryRecord[]>([]);

  useEffect(() => {
    loadMessageHistory();
  }, [patientId]);

  const loadMessageHistory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("message_history")
        .select(`
          *,
          appointments (
            appointment_date,
            type
          )
        `)
        .eq("patient_id", patientId)
        .order("sent_at", { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar histórico", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      sent: "default",
      delivered: "secondary",
      failed: "destructive",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Histórico de Mensagens - {patientName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            Nenhuma mensagem enviada ainda
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.map((message) => (
                  <TableRow key={message.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(message.sent_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {messageTypeLabels[message.message_type] || message.message_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="text-sm truncate" title={message.message_content}>
                        {message.message_content}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(message.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
