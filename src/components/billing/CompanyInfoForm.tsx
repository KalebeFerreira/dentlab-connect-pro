import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Building2, Save } from "lucide-react";
import { CompanyInfo } from "@/pages/Billing";

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
  });

  useEffect(() => {
    if (companyInfo) {
      setFormData(companyInfo);
    }
  }, [companyInfo]);

  const formatCpfCnpj = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    
    if (numbers.length <= 11) {
      // CPF: 000.000.000-00
      return numbers
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
      // CNPJ: 00.000.000/0000-00
      return numbers
        .replace(/(\d{2})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1/$2")
        .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
    }
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    // +55 (00) 00000-0000
    return numbers
      .replace(/(\d{2})(\d)/, "+$1 ($2")
      .replace(/(\d{2})(\d)/, "$1) $2")
      .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
  };

  const handleChange = (field: keyof CompanyInfo, value: string) => {
    let formattedValue = value;
    
    if (field === "cpf_cnpj") {
      formattedValue = formatCpfCnpj(value);
    } else if (field === "phone") {
      formattedValue = formatPhone(value);
    }
    
    setFormData((prev) => ({ ...prev, [field]: formattedValue }));
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
