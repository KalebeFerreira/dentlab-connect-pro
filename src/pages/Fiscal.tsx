import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FiscalSettings } from "@/components/fiscal/FiscalSettings";
import { FiscalEmitir } from "@/components/fiscal/FiscalEmitir";
import { FiscalHistorico } from "@/components/fiscal/FiscalHistorico";
import { FiscalFechamento } from "@/components/fiscal/FiscalFechamento";
import { useInvoiceLimits } from "@/hooks/useInvoiceLimits";

const Fiscal = () => {
  const [activeTab, setActiveTab] = useState("historico");
  const { usage, limit, isUnlimited } = useInvoiceLimits();

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Notas Fiscais</h1>
          <p className="text-sm text-muted-foreground">Emissão e gerenciamento de NFS-e</p>
        </div>
        <Badge variant="outline" className="text-xs">
          {isUnlimited ? "Notas ilimitadas" : `${usage}/${limit} notas este mês`}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="emitir">Emitir Nota</TabsTrigger>
          <TabsTrigger value="configuracoes">Dados Fiscais</TabsTrigger>
        </TabsList>

        <TabsContent value="historico">
          <FiscalHistorico />
        </TabsContent>

        <TabsContent value="emitir">
          <FiscalEmitir onSuccess={() => setActiveTab("historico")} />
        </TabsContent>

        <TabsContent value="configuracoes">
          <FiscalSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Fiscal;
