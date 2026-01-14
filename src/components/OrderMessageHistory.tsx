import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Mail, Clock, Trash2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface MessageHistory {
  id: string;
  message_type: string;
  recipient: string | null;
  message_content: string;
  subject: string | null;
  sent_at: string;
}

interface OrderMessageHistoryProps {
  orderId: string;
  refreshTrigger?: number;
}

export const OrderMessageHistory = ({ orderId, refreshTrigger = 0 }: OrderMessageHistoryProps) => {
  const [messages, setMessages] = useState<MessageHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMessages();
  }, [orderId, refreshTrigger]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("order_message_history")
        .select("*")
        .eq("order_id", orderId)
        .order("sent_at", { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error("Error loading message history:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este registro?")) return;

    try {
      const { error } = await supabase
        .from("order_message_history")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Registro excluído com sucesso!");
      loadMessages();
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Erro ao excluir registro");
    }
  };

  const getMessageTypeIcon = (type: string) => {
    if (type === "whatsapp") {
      return <MessageCircle className="h-4 w-4 text-green-600" />;
    }
    return <Mail className="h-4 w-4 text-blue-600" />;
  };

  const getMessageTypeBadge = (type: string) => {
    if (type === "whatsapp") {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">WhatsApp</Badge>;
    }
    return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Email</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Histórico de Mensagens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Histórico de Mensagens
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={loadMessages} title="Atualizar">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhuma mensagem enviada ainda</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className="p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getMessageTypeIcon(message.message_type)}
                      {getMessageTypeBadge(message.message_type)}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(message.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleDelete(message.id)}
                        title="Excluir"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  
                  {message.recipient && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Para: {message.recipient}
                    </p>
                  )}
                  
                  {message.subject && (
                    <p className="text-sm font-medium mt-1">
                      Assunto: {message.subject}
                    </p>
                  )}
                  
                  <p className="text-sm mt-2 line-clamp-3 text-muted-foreground">
                    {message.message_content}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
