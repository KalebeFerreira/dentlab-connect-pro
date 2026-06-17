import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Keyboard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { serviceFormSchema } from "@/lib/validationSchemas";
import { ClientAutocomplete } from "@/components/ClientAutocomplete";
import { Switch } from "@/components/ui/switch";

const WORK_COLORS = [
  { value: "A1", label: "A1" }, { value: "A2", label: "A2" },
  { value: "A3", label: "A3" }, { value: "A3.5", label: "A3.5" },
  { value: "A4", label: "A4" }, { value: "B1", label: "B1" },
  { value: "B2", label: "B2" }, { value: "B3", label: "B3" },
  { value: "B4", label: "B4" }, { value: "C1", label: "C1" },
  { value: "C2", label: "C2" }, { value: "C3", label: "C3" },
  { value: "C4", label: "C4" }, { value: "D2", label: "D2" },
  { value: "D3", label: "D3" }, { value: "D4", label: "D4" },
  { value: "BL1", label: "BL1" }, { value: "BL2", label: "BL2" },
  { value: "BL3", label: "BL3" }, { value: "BL4", label: "BL4" },
];

interface ServiceFormProps {
  onServiceAdd: () => Promise<void>;
}

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Accepts free-typing: "150", "150,50", "150.50", "1.234,56"
const parseLooseNumber = (value: string): number => {
  if (!value) return 0;
  let v = value.replace(/[^\d.,-]/g, "").trim();
  if (!v) return 0;
  const lastComma = v.lastIndexOf(",");
  const lastDot = v.lastIndexOf(".");
  if (lastComma > -1 && lastComma > lastDot) {
    v = v.replace(/\./g, "").replace(",", ".");
  } else {
    v = v.replace(/,/g, "");
  }
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

// FDI tooth numbering (upper right -> upper left, lower left -> lower right)
const UPPER_TEETH = ["18","17","16","15","14","13","12","11","21","22","23","24","25","26","27","28"];
const LOWER_TEETH = ["48","47","46","45","44","43","42","41","31","32","33","34","35","36","37","38"];

export const ServiceForm = ({ onServiceAdd }: ServiceFormProps) => {
  const [serviceName, setServiceName] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitValue, setUnitValue] = useState("");
  const [unitNumeric, setUnitNumeric] = useState<number>(0);
  const [clientName, setClientName] = useState("");
  const [patientName, setPatientName] = useState("");
  const [dentistName, setDentistName] = useState("");
  const [workColor, setWorkColor] = useState("");
  const [loading, setLoading] = useState(false);
  const [useManualInput, setUseManualInput] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"a_vista" | "a_prazo">("a_vista");
  const defaultDueDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  }, []);
  const [dueDate, setDueDate] = useState(defaultDueDate);

  // Per-tooth pricing
  const [perToothMode, setPerToothMode] = useState(false);
  const [toothValues, setToothValues] = useState<Record<string, { value: string; numeric: number }>>({});

  const selectedTeeth = Object.keys(toothValues);
  const teethTotal = useMemo(
    () => selectedTeeth.reduce((sum, t) => sum + (toothValues[t]?.numeric || 0), 0),
    [toothValues, selectedTeeth]
  );

  const quantityNumber = Number.parseInt(quantity, 10) || 0;
  const totalValue = useMemo(
    () =>
      perToothMode
        ? teethTotal
        : quantityNumber > 0
          ? unitNumeric * quantityNumber
          : 0,
    [perToothMode, teethTotal, unitNumeric, quantityNumber]
  );

  const toggleTooth = (tooth: string) => {
    setToothValues((prev) => {
      if (prev[tooth]) {
        const { [tooth]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [tooth]: { value: "", numeric: 0 } };
    });
  };

  const handleToothValueChange = (tooth: string, value: string) => {
    const numeric = parseLooseNumber(value);
    setToothValues((prev) => ({ ...prev, [tooth]: { value, numeric } }));
  };

  const handleUnitValueChange = (value: string) => {
    setUnitValue(value);
    setUnitNumeric(parseLooseNumber(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      let qty: number;
      let numericTotal: number;
      let perUnit: number;
      let finalServiceName = serviceName.trim();

      if (perToothMode) {
        if (selectedTeeth.length === 0) {
          toast.error("Selecione ao menos um dente");
          return;
        }
        const invalid = selectedTeeth.find((t) => !(toothValues[t].numeric > 0));
        if (invalid) {
          toast.error(`Informe o valor do dente ${invalid}`);
          return;
        }
        qty = selectedTeeth.length;
        numericTotal = teethTotal;
        perUnit = numericTotal / qty;
        const sortedTeeth = [...selectedTeeth].sort();
        finalServiceName = `${finalServiceName} (dentes: ${sortedTeeth.join(", ")})`;
      } else {
        qty = quantityNumber > 0 ? quantityNumber : 1;
        numericTotal = unitNumeric * qty;
        perUnit = unitNumeric;
      }

      const finalClientName = clientName?.trim() || null;

      const validationResult = serviceFormSchema.safeParse({
        service_name: finalServiceName,
        service_value: numericTotal,
        client_name: finalClientName,
        patient_name: patientName || null,
      });

      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(err => err.message).join(", ");
        toast.error("Erro de validação", { description: errors });
        return;
      }

      const { error } = await supabase.from("services").insert([
        {
          user_id: user.id,
          service_name: finalServiceName,
          service_value: numericTotal,
          unit_value: perUnit,
          quantity: qty,
          order_number: orderNumber.trim() || null,
          client_name: finalClientName?.trim() || null,
          patient_name: patientName?.trim() || null,
          dentist_name: dentistName?.trim() || null,
          color: workColor || null,
          service_date: new Date().toISOString().split("T")[0],
          status: "active",
        },
      ]);

      if (error) throw error;

      toast.success("Serviço adicionado com sucesso!");
      setServiceName("");
      setOrderNumber("");
      setQuantity("");
      setUnitValue("");
      setUnitNumeric(0);
      setClientName("");
      setPatientName("");
      setDentistName("");
      setWorkColor("");
      setToothValues({});
      await onServiceAdd();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao adicionar serviço");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Adicionar Serviço</CardTitle>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="per-tooth" className="text-sm text-muted-foreground">
                Cobrar por dente
              </Label>
              <Switch
                id="per-tooth"
                checked={perToothMode}
                onCheckedChange={(v) => {
                  setPerToothMode(v);
                  if (!v) setToothValues({});
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="manual-input" className="text-sm text-muted-foreground">
                Digitação manual
              </Label>
              <Switch
                id="manual-input"
                checked={useManualInput}
                onCheckedChange={setUseManualInput}
              />
              <Keyboard className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {useManualInput ? (
              <div className="space-y-2">
                <Label htmlFor="clinic_name">Nome da Clínica (Cliente principal)</Label>
                <Input
                  id="clinic_name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Digite o nome da clínica"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="client_name">Nome da Clínica (Cliente principal)</Label>
                <ClientAutocomplete
                  id="client_name"
                  value={clientName}
                  onChange={setClientName}
                  placeholder="Nome da clínica"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="order_number">Nº da Ordem de Serviço</Label>
              <Input
                id="order_number"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="Ex: OS-001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service_name">Trabalho Realizado *</Label>
              <Input
                id="service_name"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="Ex: Coroa, Prótese, Faceta..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient_name">Nome do Paciente</Label>
              <Input
                id="patient_name"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Nome do paciente"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dentist_name">Nome do Dentista (apenas informativo)</Label>
              <Input
                id="dentist_name"
                value={dentistName}
                onChange={(e) => setDentistName(e.target.value)}
                placeholder="Nome do dentista"
              />
            </div>

            <div className="space-y-2">
              <Label>Cor do Trabalho</Label>
              <Select value={workColor} onValueChange={setWorkColor}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a cor" />
                </SelectTrigger>
                <SelectContent>
                  {WORK_COLORS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      {color.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!perToothMode && (
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantidade de Trabalhos *</Label>
                <Input
                  id="quantity"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))}
                  placeholder="Digite a quantidade"
                  required={!perToothMode}
                />
              </div>
            )}

            {!perToothMode && (
              <div className="space-y-2">
                <Label htmlFor="unit_value">Valor Unitário *</Label>
                <Input
                  id="unit_value"
                  type="text"
                  inputMode="decimal"
                  value={unitValue}
                  onChange={(e) => handleUnitValueChange(e.target.value)}
                  placeholder="Ex: 150 ou 150,50"
                  required={!perToothMode}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="total_value">Valor Total</Label>
              <Input
                id="total_value"
                value={formatBRL(totalValue)}
                readOnly
                className="bg-muted font-semibold"
              />
            </div>
          </div>

          {perToothMode && (
            <div className="space-y-4 rounded-md border p-4">
              <div className="space-y-1">
                <Label className="text-base">Selecione os dentes (FDI)</Label>
                <p className="text-xs text-muted-foreground">
                  Clique nos dentes para incluir e informe o valor unitário de cada um. O total será somado automaticamente.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Superiores</p>
                <div className="flex flex-wrap gap-1.5">
                  {UPPER_TEETH.map((t) => {
                    const selected = !!toothValues[t];
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleTooth(t)}
                        className={`h-9 w-9 rounded-md border text-xs font-semibold transition-colors ${
                          selected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted"
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs font-medium text-muted-foreground mt-2">Inferiores</p>
                <div className="flex flex-wrap gap-1.5">
                  {LOWER_TEETH.map((t) => {
                    const selected = !!toothValues[t];
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleTooth(t)}
                        className={`h-9 w-9 rounded-md border text-xs font-semibold transition-colors ${
                          selected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted"
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedTeeth.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm">Valor por dente</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {[...selectedTeeth].sort().map((t) => (
                      <div key={t} className="flex items-center gap-2">
                        <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-md bg-primary px-2 text-xs font-semibold text-primary-foreground">
                          {t}
                        </span>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={toothValues[t].value}
                          onChange={(e) => handleToothValueChange(t, e.target.value)}
                          placeholder="Ex: 150"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleTooth(t)}
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedTeeth.length} dente(s) — Total: <span className="font-semibold text-foreground">{formatBRL(teethTotal)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full md:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Serviço
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
