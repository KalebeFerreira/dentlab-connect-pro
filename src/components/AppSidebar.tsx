import { Home, FileText, DollarSign, Users, Calendar, Image, Table2, BarChart, Building, LogOut, Receipt, Settings, Crown } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
  SidebarFooter,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Pedidos", url: "/orders", icon: FileText },
  { title: "Financeiro", url: "/financial", icon: DollarSign },
  { title: "Faturamento", url: "/billing", icon: Receipt },
  { title: "Pacientes", url: "/patients", icon: Users },
  { title: "Agendamentos", url: "/appointments", icon: Calendar },
  { title: "Análise de Mensagens", url: "/messages-analytics", icon: BarChart },
  { title: "Laboratório", url: "/laboratory", icon: Building },
  { title: "Planos", url: "/planos", icon: Crown },
  { title: "Configurações", url: "/settings", icon: Settings },
];

const toolsItems = [
  { title: "Gerador de Imagens", url: "/image-generator", icon: Image },
  { title: "Tabela de Preços", url: "/price-table", icon: Table2 },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { setOpen } = useSidebar();

  const handleNavClick = () => {
    if (isMobile) {
      setOpen(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Logout realizado com sucesso");
      navigate("/auth");
    } catch (error) {
      console.error("Error signing out:", error);
      toast.error("Erro ao fazer logout");
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarContent>
        <div className="p-3 md:p-4 border-b border-sidebar-border">
          <h2 className="text-base md:text-lg font-bold text-sidebar-foreground">DentLab Connect</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Gestão Odontológica</p>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider font-medium px-2">
            Menu Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      onClick={handleNavClick}
                      className="hover:bg-sidebar-accent/50 transition-colors group py-2.5" 
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-5 w-5 md:h-4 md:w-4" />
                      <span className="text-sm">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider font-medium px-2">
            Ferramentas IA
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {toolsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url}
                      onClick={handleNavClick}
                      className="hover:bg-sidebar-accent/50 transition-colors group py-2.5" 
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-5 w-5 md:h-4 md:w-4" />
                      <span className="text-sm">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleLogout} 
              className="hover:bg-destructive/10 text-destructive hover:text-destructive py-2.5"
            >
              <LogOut className="h-5 w-5 md:h-4 md:w-4" />
              <span className="text-sm font-medium">Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
