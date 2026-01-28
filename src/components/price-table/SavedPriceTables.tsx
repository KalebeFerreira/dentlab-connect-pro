import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Trash2, FileDown, Eye, FolderOpen, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SavedItem {
  workType: string;
  description: string;
  price: string;
  imageUrl: string | null;
}

interface SavedTable {
  id: string;
  table_name: string;
  notes: string | null;
  items: SavedItem[];
  created_at: string;
}

interface SavedPriceTablesProps {
  onLoadTable: (tableName: string, items: SavedItem[]) => void;
}

export const SavedPriceTables = ({ onLoadTable }: SavedPriceTablesProps) => {
  const [tables, setTables] = useState<SavedTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTables = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("price_tables")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Parse items from JSON - safely cast from Json type
      const parsedTables = (data || []).map(table => ({
        ...table,
        items: Array.isArray(table.items) 
          ? (table.items as unknown as SavedItem[]) 
          : [],
      })) as SavedTable[];

      setTables(parsedTables);
    } catch (error) {
      console.error("Error fetching tables:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("price_tables")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;

      setTables(tables.filter(t => t.id !== deleteId));
      toast.success("Tabela excluída");
    } catch (error: any) {
      toast.error("Erro ao excluir", { description: error.message });
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const handleLoad = (table: SavedTable) => {
    onLoadTable(table.table_name, table.items);
    toast.success("Tabela carregada");
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (tables.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <FolderOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground">Nenhuma tabela salva ainda</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Crie uma tabela e clique em "Salvar Tabela"
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Tabelas Salvas
          </CardTitle>
          <CardDescription>
            {tables.length} tabela(s) salva(s)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {tables.map((table) => (
            <div
              key={table.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{table.table_name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(table.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  <span>•</span>
                  <span>{table.items.length} item(ns)</span>
                </div>
              </div>
              <div className="flex gap-1 ml-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleLoad(table)}
                  title="Carregar tabela"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteId(table.id)}
                  className="text-destructive hover:text-destructive"
                  title="Excluir tabela"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tabela?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A tabela será permanentemente excluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
