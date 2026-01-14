import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  LayoutTemplate, 
  Sparkles, 
  Stethoscope, 
  Gift, 
  Calendar, 
  Star,
  TrendingUp,
  Heart,
  Loader2,
  Check
} from "lucide-react";

interface CarouselTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  slides: {
    prompt: string;
    suggestedText?: string;
  }[];
  color: string;
}

const CAROUSEL_TEMPLATES: CarouselTemplate[] = [
  {
    id: "promo-sale",
    name: "Promoção de Vendas",
    description: "Carrossel de 5 slides para promoções e descontos",
    category: "Promocional",
    icon: <Gift className="h-5 w-5" />,
    color: "bg-orange-500/10 text-orange-600",
    slides: [
      { prompt: "Eye-catching promotional banner with big discount percentage, modern retail design, vibrant colors", suggestedText: "MEGA PROMOÇÃO" },
      { prompt: "Product showcase with price tag and discount badge, clean e-commerce style", suggestedText: "ATÉ 50% OFF" },
      { prompt: "Happy customers with shopping bags, lifestyle marketing photography", suggestedText: "APROVEITE AGORA" },
      { prompt: "Limited time offer countdown design, urgency marketing visual", suggestedText: "OFERTA LIMITADA" },
      { prompt: "Call to action banner with shop now button design, modern marketing", suggestedText: "COMPRE JÁ" }
    ]
  },
  {
    id: "dental-clinic",
    name: "Clínica Odontológica",
    description: "Carrossel de 5 slides para clínicas dentárias",
    category: "Saúde",
    icon: <Stethoscope className="h-5 w-5" />,
    color: "bg-blue-500/10 text-blue-600",
    slides: [
      { prompt: "Modern dental clinic interior, clean and welcoming atmosphere, professional healthcare setting", suggestedText: "SORRISO PERFEITO" },
      { prompt: "Professional dentist examining patient, caring and gentle approach, medical photography", suggestedText: "CUIDADO ESPECIALIZADO" },
      { prompt: "Beautiful smile close-up, teeth whitening result, dental aesthetics", suggestedText: "CLAREAMENTO DENTAL" },
      { prompt: "Dental implant and orthodontics showcase, modern dentistry technology", suggestedText: "TECNOLOGIA AVANÇADA" },
      { prompt: "Family dental care, parents and children at dentist, friendly atmosphere", suggestedText: "AGENDE SUA CONSULTA" }
    ]
  },
  {
    id: "health-wellness",
    name: "Saúde e Bem-estar",
    description: "Carrossel de 4 slides para serviços de saúde",
    category: "Saúde",
    icon: <Heart className="h-5 w-5" />,
    color: "bg-green-500/10 text-green-600",
    slides: [
      { prompt: "Healthy lifestyle, person doing yoga or meditation, wellness and peace", suggestedText: "CUIDE DE VOCÊ" },
      { prompt: "Healthy food and nutrition, colorful fruits and vegetables, health diet", suggestedText: "ALIMENTAÇÃO SAUDÁVEL" },
      { prompt: "Professional healthcare team, doctors and nurses smiling, medical care", suggestedText: "EQUIPE ESPECIALIZADA" },
      { prompt: "Modern healthcare facility, clean medical environment, wellness center", suggestedText: "AGENDE AGORA" }
    ]
  },
  {
    id: "event-launch",
    name: "Evento ou Lançamento",
    description: "Carrossel de 6 slides para eventos especiais",
    category: "Evento",
    icon: <Calendar className="h-5 w-5" />,
    color: "bg-purple-500/10 text-purple-600",
    slides: [
      { prompt: "Grand event announcement banner, elegant design with confetti and celebration", suggestedText: "GRANDE EVENTO" },
      { prompt: "Event venue decoration, beautiful party setup, professional event photography", suggestedText: "DIA ESPECIAL" },
      { prompt: "Guest speakers or VIP portraits, professional headshots, corporate event", suggestedText: "PALESTRANTES" },
      { prompt: "Event schedule or agenda infographic, modern timeline design", suggestedText: "PROGRAMAÇÃO" },
      { prompt: "Event location map and venue photo, easy to find directions", suggestedText: "LOCALIZAÇÃO" },
      { prompt: "Registration call to action, book now design, event tickets", suggestedText: "INSCREVA-SE" }
    ]
  },
  {
    id: "testimonials",
    name: "Depoimentos",
    description: "Carrossel de 4 slides com avaliações de clientes",
    category: "Social Proof",
    icon: <Star className="h-5 w-5" />,
    color: "bg-yellow-500/10 text-yellow-600",
    slides: [
      { prompt: "Five star rating display, customer satisfaction, review stars golden", suggestedText: "★★★★★ 5 ESTRELAS" },
      { prompt: "Happy customer portrait with quote, testimonial design, genuine smile", suggestedText: "CLIENTE SATISFEITO" },
      { prompt: "Before and after comparison, transformation results, success story", suggestedText: "RESULTADOS REAIS" },
      { prompt: "Trust badges and certifications display, professional credibility", suggestedText: "CONFIANÇA GARANTIDA" }
    ]
  },
  {
    id: "product-showcase",
    name: "Vitrine de Produtos",
    description: "Carrossel de 5 slides para mostrar produtos",
    category: "E-commerce",
    icon: <TrendingUp className="h-5 w-5" />,
    color: "bg-pink-500/10 text-pink-600",
    slides: [
      { prompt: "Hero product shot, premium product photography, elegant lighting", suggestedText: "NOVO LANÇAMENTO" },
      { prompt: "Product features infographic, benefits and specifications display", suggestedText: "CARACTERÍSTICAS" },
      { prompt: "Product in use lifestyle photo, real world application", suggestedText: "EM AÇÃO" },
      { prompt: "Product packaging and unboxing, premium presentation", suggestedText: "EMBALAGEM PREMIUM" },
      { prompt: "Price and offer banner, buy now call to action, shopping design", suggestedText: "COMPRE AGORA" }
    ]
  },
  {
    id: "services-intro",
    name: "Apresentação de Serviços",
    description: "Carrossel de 7 slides para apresentar serviços",
    category: "Corporativo",
    icon: <LayoutTemplate className="h-5 w-5" />,
    color: "bg-indigo-500/10 text-indigo-600",
    slides: [
      { prompt: "Company logo and tagline hero banner, professional corporate branding", suggestedText: "NOSSA EMPRESA" },
      { prompt: "Professional team working together, modern office environment", suggestedText: "QUEM SOMOS" },
      { prompt: "Service icon grid or infographic, what we offer display", suggestedText: "NOSSOS SERVIÇOS" },
      { prompt: "Work process steps infographic, how we work methodology", suggestedText: "COMO FUNCIONA" },
      { prompt: "Portfolio or case study showcase, successful projects", suggestedText: "PORTFÓLIO" },
      { prompt: "Client logos and partnerships, trusted by companies", suggestedText: "NOSSOS CLIENTES" },
      { prompt: "Contact information and call to action, get in touch design", suggestedText: "FALE CONOSCO" }
    ]
  }
];

interface CarouselTemplatesProps {
  onSelectTemplate: (slides: { prompt: string; suggestedText?: string }[]) => void;
  isGenerating: boolean;
}

export const CarouselTemplates = ({ onSelectTemplate, isGenerating }: CarouselTemplatesProps) => {
  const [selectedTemplate, setSelectedTemplate] = useState<CarouselTemplate | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleApplyTemplate = () => {
    if (!selectedTemplate) return;
    
    onSelectTemplate(selectedTemplate.slides);
    setDialogOpen(false);
    setSelectedTemplate(null);
    toast.success(`Template "${selectedTemplate.name}" aplicado! Gerando ${selectedTemplate.slides.length} imagens...`);
  };

  const groupedTemplates = CAROUSEL_TEMPLATES.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, CarouselTemplate[]>);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full" disabled={isGenerating}>
          <LayoutTemplate className="h-4 w-4 mr-2" />
          Usar Template Pronto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5 text-primary" />
            Templates de Carrossel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {Object.entries(groupedTemplates).map(([category, templates]) => (
            <div key={category}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">{category}</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {templates.map((template) => (
                  <Card 
                    key={template.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedTemplate?.id === template.id 
                        ? "ring-2 ring-primary" 
                        : "hover:border-primary/50"
                    }`}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${template.color}`}>
                          {template.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-sm">{template.name}</h4>
                            {selectedTemplate?.id === template.id && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {template.description}
                          </p>
                          <Badge variant="outline" className="mt-2 text-xs">
                            {template.slides.length} slides
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Selected Template Preview */}
        {selectedTemplate && (
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium text-sm mb-3">Preview dos Slides</h4>
            <div className="flex flex-wrap gap-2">
              {selectedTemplate.slides.map((slide, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-full text-xs border"
                >
                  <span className="font-medium text-primary">{index + 1}.</span>
                  <span className="truncate max-w-[150px]">
                    {slide.suggestedText || slide.prompt.slice(0, 30)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Apply Button */}
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={() => setDialogOpen(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleApplyTemplate}
            disabled={!selectedTemplate || isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Aplicar Template
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
