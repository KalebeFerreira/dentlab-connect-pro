import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, FileText, Users, Zap, Clock, Shield, TrendingUp, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: FileText,
      title: "Gestão de Ordens de Trabalho",
      description: "Controle completo de todas as ordens com acompanhamento em tempo real"
    },
    {
      icon: Users,
      title: "Comunicação Integrada",
      description: "WhatsApp integrado para comunicação direta com clínicas e dentistas"
    },
    {
      icon: TrendingUp,
      title: "Relatórios Financeiros",
      description: "Análise completa de receitas, despesas e lucratividade do laboratório"
    },
    {
      icon: Clock,
      title: "Gestão de Prazos",
      description: "Notificações automáticas e controle de entregas para nunca atrasar"
    },
    {
      icon: Shield,
      title: "Dados Seguros",
      description: "Seus dados protegidos com criptografia e backups automáticos"
    },
    {
      icon: Smartphone,
      title: "Acesso Mobile",
      description: "Gerencie seu laboratório de qualquer lugar, a qualquer momento"
    }
  ];

  const benefits = [
    "Redução de 70% no tempo de gestão de ordens",
    "Comunicação 100% integrada com WhatsApp",
    "Controle financeiro completo e automatizado",
    "Geração automática de PDFs e documentos",
    "Tabelas de preços com IA para impressionar clientes",
    "Relatórios mensais prontos para envio"
  ];

  const testimonials = [
    {
      name: "Dr. Carlos Silva",
      role: "Dono de Laboratório",
      text: "O Essência revolucionou a forma como gerencio meu laboratório. Economia de tempo e muito mais organização!"
    },
    {
      name: "Dra. Ana Paula",
      role: "Clínica Odontológica",
      text: "A comunicação com o laboratório nunca foi tão fácil. Tudo em um só lugar!"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-primary py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-block rounded-full bg-background/10 px-4 py-2 backdrop-blur-sm">
              <span className="text-sm font-medium text-primary-foreground">
                ✨ Sistema Profissional de Gestão Odontológica
              </span>
            </div>
            <h1 className="mb-6 text-4xl font-bold leading-tight text-primary-foreground md:text-6xl">
              Conectando Clínicas e Laboratórios de Forma Inteligente
            </h1>
            <p className="mb-8 text-lg text-primary-foreground/90 md:text-xl">
              Gerencie ordens de trabalho, controle financeiro e comunicação em uma única plataforma. 
              Mais eficiência, menos trabalho manual.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button 
                size="lg" 
                variant="secondary"
                onClick={() => navigate("/auth")}
                className="text-base"
              >
                Começar Gratuitamente
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate("/planos")}
                className="border-primary-foreground/20 bg-transparent text-primary-foreground hover:bg-background/10"
              >
                Ver Planos
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              Tudo que seu laboratório precisa
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Uma plataforma completa para transformar a gestão do seu laboratório odontológico
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <Card key={index} className="border-border/50 shadow-card transition-all hover:shadow-elevated">
                <CardContent className="p-6">
                  <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl">
            <div className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold md:text-4xl">
                Por que escolher o Essência?
              </h2>
              <p className="text-lg text-muted-foreground">
                Resultados comprovados que fazem a diferença no seu dia a dia
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <CheckCircle className="mt-1 h-5 w-5 flex-shrink-0 text-primary" />
                  <span className="text-foreground">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              Como funciona?
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Em poucos passos você está pronto para otimizar sua gestão
            </p>
          </div>

          <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-3">
            {[
              { step: "1", title: "Cadastre-se", desc: "Crie sua conta gratuitamente em menos de 2 minutos" },
              { step: "2", title: "Configure", desc: "Adicione seus dados e personalize conforme sua necessidade" },
              { step: "3", title: "Comece a usar", desc: "Gerencie tudo de forma intuitiva e eficiente" }
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                  {item.step}
                </div>
                <h3 className="mb-2 text-xl font-semibold">{item.title}</h3>
                <p className="text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              O que nossos clientes dizem
            </h2>
          </div>

          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="shadow-card">
                <CardContent className="p-6">
                  <p className="mb-4 text-lg italic text-foreground">"{testimonial.text}"</p>
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-primary py-20">
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-6 text-3xl font-bold text-primary-foreground md:text-4xl">
              Pronto para transformar seu laboratório?
            </h2>
            <p className="mb-8 text-lg text-primary-foreground/90">
              Junte-se a centenas de laboratórios que já otimizaram sua gestão
            </p>
            <Button 
              size="lg" 
              variant="secondary"
              onClick={() => navigate("/auth")}
              className="text-base"
            >
              Começar Agora - É Grátis
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <h3 className="mb-4 text-lg font-semibold">Essência dental-lab</h3>
              <p className="text-sm text-muted-foreground">
                Sistema profissional para gestão de ordens de trabalho odontológico
              </p>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold">Links Rápidos</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <button onClick={() => navigate("/planos")} className="text-muted-foreground hover:text-foreground">
                    Planos
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate("/auth")} className="text-muted-foreground hover:text-foreground">
                    Login
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold">Contato</h4>
              <p className="text-sm text-muted-foreground">
                contato@essenciadental-lab.com.br
              </p>
            </div>
          </div>
          <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
            © 2025 Essência dental-lab. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
