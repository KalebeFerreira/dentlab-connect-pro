import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Building2, Save, Upload, X } from "lucide-react";
import { CompanyInfo } from "@/pages/Billing";
import { toast } from "sonner";

interface CompanyInfoFormProps {
  companyInfo: CompanyInfo | null;
  onSave: (info: CompanyInfo) => Promise<void>;
}

export const CompanyInfoForm = ({ companyInfo, onSave }: CompanyInfoFormProps) => {
  const [formData, setFormData] = useState<CompanyInfo>({
    company_name: "",
    cpf_cnpj: "",
    email: "",
    phone: "",
    logo_url: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (companyInfo) {
      setFormData(companyInfo);
    }
  }, [companyInfo]);

  const formatCpfCnpj = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 11) {
      return numbers
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
      return numbers
        .replace(/(\d{2})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1/$2")
        .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
    }
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers
      .replace(/(\d{2})(\d)/, "+$1 ($2")
      .replace(/(\d{2})(\d)/, "$1) $2")
      .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
  };

  const handleChange = (field: keyof CompanyInfo, value: string) => {
    let formattedValue = value;
    if (field === "cpf_cnpj") formattedValue = formatCpfCnpj(value);
    else if (field === "phone") formattedValue = formatPhone(value);
    setFormData((prev) => ({ ...prev, [field]: formattedValue }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo deve ter no máximo 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setFormData((prev) => ({ ...prev, logo_url: dataUrl }));
      toast.success("Logo carregada. Clique em Salvar para confirmar.");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setFormData((prev) => ({ ...prev, logo_url: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Dados da Empresa
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Logo da Empresa</Label>
            <div className="flex items-center gap-4 flex-wrap">
              {formData.logo_url ? (
                <div className="relative">
                  <img
                    src={formData.logo_url}
                    alt="Logo"
                    className="h-20 w-auto max-w-[200px] object-contain border rounded p-2 bg-white"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={handleRemoveLogo}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="h-20 w-32 border-2 border-dashed rounded flex items-center justify-center text-muted-foreground text-xs">
                  Sem logo
                </div>
              )}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {formData.logo_url ? "Trocar logo" : "Enviar logo"}
                </Button>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG ou SVG. Máximo 2MB.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Nome da Empresa</Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) => handleChange("company_name", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf_cnpj">CPF/CNPJ</Label>
              <Input
                id="cpf_cnpj"
                value={formData.cpf_cnpj}
                onChange={(e) => handleChange("cpf_cnpj", e.target.value)}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone/WhatsApp</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="+55 (00) 00000-0000"
                required
              />
            </div>
          </div>

          <Button type="submit" className="w-full md:w-auto">
            <Save className="h-4 w-4 mr-2" />
            Salvar Informações
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
