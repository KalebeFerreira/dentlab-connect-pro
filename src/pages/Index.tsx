import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, FileText, Users, Zap, Clock, Shield, TrendingUp, Smartphone, Menu, X, ChevronRight, Star, ArrowRight, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const Index = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    {
      icon: FileText,
      title: "Ordens de Trabalho Digitais",
      description: "Envio e recebimento de pedidos entre clínicas e laboratórios em tempo real"
    },
    {
      icon: Users,
      title: "Comunicação Direta",
      description: "Dentistas e protéticos conectados - tire dúvidas e envie fotos"
    },
    {
      icon: TrendingUp,
      title: "Gestão Financeira",
      description: "Controle de pagamentos, faturamento e relatórios automáticos"
    },
    {
      icon: Clock,
      title: "Prazos Sob Controle",
      description: "Notificações automáticas de prazos de entrega"
    },
    {
      icon: Shield,
      title: "Segurança Total",
      description: "Dados protegidos com criptografia e backup na nuvem"
    },
    {
      icon: Smartphone,
      title: "Acesso Mobile",
      description: "Acesse e gerencie tudo pelo celular, de qualquer lugar"
    }
  ];

  const benefits = [
    "Eliminação de 90% dos erros de comunicação",
    "Envio de pedidos em segundos",
    "Acompanhamento em tempo real",
    "Notificações automáticas de prazos",
    "Gestão financeira integrada",
    "Histórico completo de trabalhos"
  ];

  const testimonials = [
    {
      name: "TPD Roberto Mendes",
      role: "Dono de Laboratório",
      text: "O Essência revolucionou a forma como gerencio meu laboratório. Economia de tempo e muito mais organização!",
      rating: 5
    },
    {
      name: "Dra. Ana Paula",
      role: "Clínica Odontológica",
      text: "A comunicação com o laboratório nunca foi tão fácil. Tudo em um só lugar!",
      rating: 5
    },
    {
      name: "Dr. Marcos Almeida",
      role: "Dentista",
      text: "Sistema intuitivo e completo. Facilita muito o acompanhamento dos trabalhos!",
      rating: 5
    },
    {
      name: "TPD Fernanda Costa",
      role: "Protética",
      text: "Agora consigo organizar todas as ordens de forma eficiente. A geração de PDFs é sensacional!",
      rating: 5
    }
  ];

  const stats = [
    { value: "500+", label: "Clínicas Conectadas" },
    { value: "200+", label: "Laboratórios Parceiros" },
    { value: "50k+", label: "Ordens Processadas" },
    { value: "99.9%", label: "Uptime Garantido" }
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Mobile Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b lg:hidden">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                <span className="text-white font-bold text-sm">E</span>
              </div>
              <span className="font-bold text-lg text-foreground">Essência</span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
          
          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="absolute top-16 left-0 right-0 bg-background border-b shadow-lg animate-fade-in">
              <nav className="container mx-auto px-4 py-4 flex flex-col gap-2">
                <button
                  onClick={() => {
                    navigate("/auth");
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-3 px-4 text-left rounded-lg hover:bg-muted transition-colors font-medium"
                >
                  Login
                </button>
                <button
                  onClick={() => {
                    navigate("/planos");
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-3 px-4 text-left rounded-lg hover:bg-muted transition-colors font-medium"
                >
                  Planos
                </button>
                <Button 
                  className="w-full mt-2"
                  onClick={() => {
                    navigate("/auth");
                    setMobileMenuOpen(false);
                  }}
                >
                  Começar Grátis
                </Button>
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* Desktop Header */}
      <header className="hidden lg:block sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">E</span>
              </div>
              <span className="font-bold text-xl text-foreground">Essência dental-lab</span>
            </div>
            <nav className="flex items-center gap-8">
              <button 
                onClick={() => navigate("/planos")}
                className="text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                Planos
              </button>
              <button 
                onClick={() => navigate("/auth")}
                className="text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                Login
              </button>
              <Button onClick={() => navigate("/auth")}>
                Começar Grátis
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden gradient-hero py-12 sm:py-16 md:py-24 lg:py-32">
        <div className="absolute inset-0 bg-grid-white/[0.05] pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-4 sm:mb-6 inline-block rounded-full bg-white/20 px-3 sm:px-4 py-1.5 sm:py-2 backdrop-blur-sm animate-fade-in">
              <span className="text-xs sm:text-sm font-medium text-white">
                ✨ A Ponte Digital Entre Clínicas e Laboratórios
              </span>
            </div>
            <h1 className="mb-4 sm:mb-6 text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-white animate-fade-in [animation-delay:100ms]">
              Integração Total Entre 
              <span className="block mt-1 sm:mt-2">Dentistas e Protéticos</span>
            </h1>
            <p className="mb-6 sm:mb-8 text-base sm:text-lg md:text-xl text-white/90 animate-fade-in [animation-delay:200ms] max-w-2xl mx-auto px-4">
              Envie pedidos, acompanhe em tempo real e gerencie tudo em uma única plataforma. 
              Zero erros de comunicação.
            </p>
            <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:justify-center animate-fade-in [animation-delay:300ms] px-4">
              <Button 
                size="lg" 
                className="text-sm sm:text-base bg-secondary hover:bg-secondary/90 text-white shadow-lg hover-scale w-full sm:w-auto"
                onClick={() => navigate("/auth")}
              >
                Começar Gratuitamente
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate("/planos")}
                className="border-2 border-white bg-white/10 text-white hover:bg-white hover:text-primary backdrop-blur-sm w-full sm:w-auto"
              >
                Ver Planos
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-8 sm:py-12 bg-card border-y">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8">
            {stats.map((stat, index) => (
              <div 
                key={index} 
                className="text-center animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary mb-1">
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-16 md:py-20 bg-gradient-soft">
        <div className="container mx-auto px-4">
          <div className="mb-10 sm:mb-16 text-center animate-fade-in">
            <h2 className="mb-3 sm:mb-4 text-2xl sm:text-3xl md:text-4xl font-bold text-primary">
              Tudo que você precisa
            </h2>
            <p className="mx-auto max-w-2xl text-sm sm:text-base md:text-lg text-foreground px-4">
              Uma plataforma completa que conecta dentistas e protéticos de forma inteligente
            </p>
          </div>

          <div className="grid gap-4 sm:gap-6 md:gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="border-2 border-primary/20 shadow-card hover-lift group animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="mb-3 sm:mb-4 inline-flex rounded-xl bg-gradient-primary p-2.5 sm:p-3 shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <feature.icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                  <h3 className="mb-2 text-lg sm:text-xl font-semibold text-foreground">{feature.title}</h3>
                  <p className="text-sm sm:text-base text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-12 sm:py-16 md:py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 sm:mb-12 text-center animate-fade-in">
              <h2 className="mb-3 sm:mb-4 text-2xl sm:text-3xl md:text-4xl font-bold text-primary">
                Por que escolher o Essência?
              </h2>
              <p className="text-sm sm:text-base md:text-lg text-foreground px-4">
                Eficiência comprovada na comunicação entre dentistas e protéticos
              </p>
            </div>

            <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
              {benefits.map((benefit, index) => (
                <div 
                  key={index} 
                  className="flex items-start gap-3 p-3 sm:p-4 rounded-lg hover:bg-primary/5 transition-colors duration-300 animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-secondary" />
                  <span className="text-sm sm:text-base text-foreground font-medium">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-12 sm:py-16 md:py-20 bg-gradient-soft">
        <div className="container mx-auto px-4">
          <div className="mb-10 sm:mb-16 text-center animate-fade-in">
            <h2 className="mb-3 sm:mb-4 text-2xl sm:text-3xl md:text-4xl font-bold text-primary">
              Como funciona?
            </h2>
            <p className="mx-auto max-w-2xl text-sm sm:text-base md:text-lg text-foreground px-4">
              Em poucos passos você estará conectado
            </p>
          </div>

          <div className="mx-auto grid max-w-4xl gap-6 sm:gap-8 grid-cols-1 md:grid-cols-3">
            {[
              { step: "1", title: "Cadastre-se", desc: "Crie sua conta grátis em 2 minutos" },
              { step: "2", title: "Conecte-se", desc: "Adicione seus parceiros e comece a integração" },
              { step: "3", title: "Trabalhe Integrado", desc: "Envie pedidos e gerencie tudo em tempo real" }
            ].map((item, index) => (
              <div 
                key={index} 
                className="text-center group animate-fade-in relative"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                {index < 2 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary/50 to-transparent" />
                )}
                <div className="mb-3 sm:mb-4 inline-flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full gradient-primary text-xl sm:text-2xl font-bold text-white shadow-lg group-hover:scale-110 transition-transform duration-300">
                  {item.step}
                </div>
                <h3 className="mb-2 text-lg sm:text-xl font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm sm:text-base text-muted-foreground px-4">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials - Carousel for mobile */}
      <section className="py-12 sm:py-16 md:py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="mb-10 sm:mb-16 text-center animate-fade-in">
            <h2 className="mb-3 sm:mb-4 text-2xl sm:text-3xl md:text-4xl font-bold text-primary">
              O que nossos clientes dizem
            </h2>
          </div>

          {/* Mobile Carousel */}
          <div className="md:hidden">
            <Carousel className="w-full max-w-sm mx-auto">
              <CarouselContent>
                {testimonials.map((testimonial, index) => (
                  <CarouselItem key={index}>
                    <Card className="shadow-card border-2 border-primary/10">
                      <CardContent className="p-4 sm:p-6">
                        <div className="flex gap-0.5 mb-3">
                          {[...Array(testimonial.rating)].map((_, i) => (
                            <Star key={i} className="h-4 w-4 fill-secondary text-secondary" />
                          ))}
                        </div>
                        <p className="mb-4 text-sm italic text-card-foreground">"{testimonial.text}"</p>
                        <div>
                          <p className="font-semibold text-sm text-card-foreground">{testimonial.name}</p>
                          <p className="text-xs text-primary">{testimonial.role}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-0" />
              <CarouselNext className="right-0" />
            </Carousel>
          </div>

          {/* Desktop Grid */}
          <div className="hidden md:grid mx-auto max-w-5xl gap-6 lg:gap-8 md:grid-cols-2">
            {testimonials.map((testimonial, index) => (
              <Card 
                key={index} 
                className="shadow-card hover-lift border-2 border-primary/10 animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardContent className="p-6">
                  <div className="flex gap-0.5 mb-3">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-secondary text-secondary" />
                    ))}
                  </div>
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
      <section className="gradient-secondary py-12 sm:py-16 md:py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.05] pointer-events-none" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="mx-auto max-w-3xl animate-fade-in">
            <h2 className="mb-4 sm:mb-6 text-2xl sm:text-3xl md:text-4xl font-bold text-white">
              Pronto para começar?
            </h2>
            <p className="mb-6 sm:mb-8 text-base sm:text-lg md:text-xl text-white/90 px-4">
              Junte-se a centenas de dentistas e protéticos que já trabalham de forma integrada
            </p>
            <Button 
              size="lg" 
              onClick={() => navigate("/auth")}
              className="text-sm sm:text-base bg-white text-secondary hover:bg-white/90 shadow-lg hover-scale"
            >
              Começar Agora - É Grátis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30 py-8 sm:py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                  <span className="text-white font-bold text-sm">E</span>
                </div>
                <span className="font-bold text-lg text-primary">Essência</span>
              </div>
              <p className="text-sm text-foreground">
                A plataforma que conecta clínicas e laboratórios em uma única solução
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
          <div className="mt-8 border-t pt-8 text-center text-xs sm:text-sm text-muted-foreground">
            © 2025 Essência dental-lab. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
