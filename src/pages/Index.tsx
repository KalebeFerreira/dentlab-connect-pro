import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, FileText, Users, Zap, Clock, Shield, TrendingUp, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: FileText,
      title: "Ordens de Trabalho Digitais",
      description: "Envio e recebimento de pedidos entre clínicas e laboratórios em tempo real, com acompanhamento completo do status"
    },
    {
      icon: Users,
      title: "Comunicação Direta",
      description: "Dentistas e protéticos conectados diretamente - tire dúvidas, envie fotos e acompanhe cada etapa do trabalho"
    },
    {
      icon: TrendingUp,
      title: "Gestão Financeira Integrada",
      description: "Controle de pagamentos, faturamento e relatórios automáticos tanto para clínicas quanto laboratórios"
    },
    {
      icon: Clock,
      title: "Prazos Sob Controle",
      description: "Notificações automáticas de prazos de entrega para clínicas e laboratórios - nunca mais perca um deadline"
    },
    {
      icon: Shield,
      title: "Segurança Total",
      description: "Dados de pacientes e trabalhos protegidos com criptografia e backup automático na nuvem"
    },
    {
      icon: Smartphone,
      title: "Acesso Mobile",
      description: "Dentistas e protéticos podem acessar e gerenciar tudo pelo celular, de qualquer lugar"
    }
  ];

  const benefits = [
    "Eliminação de 90% dos erros de comunicação entre clínica e laboratório",
    "Envio e recebimento de pedidos em segundos, sem telefonemas ou WhatsApp perdido",
    "Acompanhamento em tempo real do status de cada trabalho protético",
    "Notificações automáticas de prazos para dentistas e laboratórios",
    "Gestão financeira integrada - controle total de pagamentos e faturamento",
    "Histórico completo de todos os trabalhos e comunicações em um só lugar"
  ];

  const testimonials = [
    {
      name: "TPD Roberto Mendes",
      role: "Dono de Laboratório",
      text: "O Essência revolucionou a forma como gerencio meu laboratório. Economia de tempo e muito mais organização!"
    },
    {
      name: "Dra. Ana Paula",
      role: "Clínica Odontológica",
      text: "A comunicação com o laboratório nunca foi tão fácil. Tudo em um só lugar!"
    },
    {
      name: "Dr. Marcos Almeida",
      role: "Dentista",
      text: "Sistema intuitivo e completo. Facilita muito o acompanhamento dos trabalhos enviados ao laboratório!"
    },
    {
      name: "TPD Fernanda Costa",
      role: "Protética",
      text: "Agora consigo organizar todas as ordens de forma eficiente. A geração de PDFs automática é sensacional!"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden gradient-hero py-20 md:py-32">
        <div className="absolute inset-0 bg-grid-white/[0.05] pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-block rounded-full bg-white/20 px-4 py-2 backdrop-blur-sm animate-fade-in">
              <span className="text-sm font-medium text-white">
                ✨ A Ponte Digital Entre Clínicas e Laboratórios
              </span>
            </div>
            <h1 className="mb-6 text-4xl font-bold leading-tight text-white md:text-6xl animate-fade-in [animation-delay:100ms]">
              Integração Total Entre Dentistas e Protéticos
            </h1>
            <p className="mb-8 text-lg text-white md:text-xl animate-fade-in [animation-delay:200ms]">
              Envie pedidos, acompanhe em tempo real, comunique-se diretamente e gerencie tudo em uma única plataforma. 
              Mais agilidade para clínicas. Mais organização para laboratórios. Zero erros de comunicação.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center animate-fade-in [animation-delay:300ms]">
              <Button 
                size="lg" 
                className="text-base bg-secondary hover:bg-secondary/90 text-white shadow-lg hover-scale"
                onClick={() => navigate("/auth")}
              >
                Começar Gratuitamente
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate("/planos")}
                className="border-2 border-white bg-white/10 text-white hover:bg-white hover:text-primary backdrop-blur-sm"
              >
                Ver Planos
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gradient-soft">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center animate-fade-in">
            <h2 className="mb-4 text-3xl font-bold text-primary md:text-4xl">
              Tudo que clínicas e laboratórios precisam
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-foreground">
              Uma plataforma completa que conecta dentistas e protéticos de forma inteligente, rápida e sem erros
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="border-2 border-primary/20 shadow-card hover-lift group animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardContent className="p-6">
                  <div className="mb-4 inline-flex rounded-xl bg-gradient-primary p-3 shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold text-foreground">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl">
            <div className="mb-12 text-center animate-fade-in">
              <h2 className="mb-4 text-3xl font-bold text-primary md:text-4xl">
                Por que clínicas e laboratórios escolhem o Essência?
              </h2>
              <p className="text-lg text-foreground">
                Eficiência comprovada na comunicação e gestão entre dentistas e protéticos
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {benefits.map((benefit, index) => (
                <div 
                  key={index} 
                  className="flex items-start gap-3 p-4 rounded-lg hover:bg-primary/5 transition-colors duration-300 animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <CheckCircle className="mt-1 h-5 w-5 flex-shrink-0 text-secondary" />
                  <span className="text-foreground font-medium">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 bg-gradient-soft">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center animate-fade-in">
            <h2 className="mb-4 text-3xl font-bold text-primary md:text-4xl">
              Como funciona?
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-foreground">
              Em poucos passos clínicas e laboratórios estarão conectados e trabalhando de forma integrada
            </p>
          </div>

          <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-3">
            {[
              { step: "1", title: "Cadastre-se", desc: "Clínica ou laboratório? Crie sua conta grátis em 2 minutos" },
              { step: "2", title: "Conecte-se", desc: "Adicione seus parceiros - laboratórios ou clínicas - e comece a integração" },
              { step: "3", title: "Trabalhe Integrado", desc: "Envie pedidos, acompanhe status, comunique-se e gerencie tudo em tempo real" }
            ].map((item, index) => (
              <div 
                key={index} 
                className="text-center group animate-fade-in"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full gradient-primary text-2xl font-bold text-white shadow-lg group-hover:scale-110 transition-transform duration-300">
                  {item.step}
                </div>
                <h3 className="mb-2 text-xl font-semibold text-foreground">{item.title}</h3>
                <p className="text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center animate-fade-in">
            <h2 className="mb-4 text-3xl font-bold text-primary md:text-4xl">
              O que nossos clientes dizem
            </h2>
          </div>

          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2 lg:grid-cols-2">
            {testimonials.map((testimonial, index) => (
              <Card 
                key={index} 
                className="shadow-card hover-lift border-2 border-primary/10 animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardContent className="p-6">
                  <p className="mb-4 text-lg italic text-card-foreground">"{testimonial.text}"</p>
                  <div>
                    <p className="font-semibold text-card-foreground">{testimonial.name}</p>
                    <p className="text-sm text-primary">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="gradient-secondary py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.05] pointer-events-none" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="mx-auto max-w-3xl animate-fade-in">
            <h2 className="mb-6 text-3xl font-bold text-white md:text-4xl">
              Pronto para integrar clínica e laboratório?
            </h2>
            <p className="mb-8 text-lg text-white md:text-xl">
              Junte-se a centenas de dentistas e protéticos que já trabalham de forma integrada e eficiente
            </p>
            <Button 
              size="lg" 
              onClick={() => navigate("/auth")}
              className="text-base bg-white text-secondary hover:bg-white/90 shadow-lg hover-scale"
            >
              Começar Agora - É Grátis
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30 py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <h3 className="mb-4 text-lg font-semibold text-primary">Essência dental-lab</h3>
              <p className="text-sm text-foreground">
                A plataforma que conecta clínicas odontológicas e laboratórios de prótese em uma única solução integrada
              </p>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold text-foreground">Links Rápidos</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <button onClick={() => navigate("/planos")} className="text-muted-foreground hover:text-primary transition-colors">
                    Planos
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate("/auth")} className="text-muted-foreground hover:text-primary transition-colors">
                    Login
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold text-foreground">Contato</h4>
              <p className="text-sm text-foreground">
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
