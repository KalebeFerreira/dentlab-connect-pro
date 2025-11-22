import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useFreemiumLimits } from "@/hooks/useFreemiumLimits";
import { 
  Crown, 
  ShoppingCart, 
  Users, 
  Sparkles, 
  FileText, 
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Lock
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface UsageCardProps {
  title: string;
  icon: React.ReactNode;
  current: number;
  limit: number;
  percentage: number;
  unit: string;
  description: string;
  isUnlimited: boolean;
}

const UsageCard = ({ 
  title, 
  icon, 
  current, 
  limit, 
  percentage, 
  unit,
  description,
  isUnlimited 
}: UsageCardProps) => {
  const getStatusColor = () => {
    if (isUnlimited) return "text-green-500";
    if (percentage >= 100) return "text-red-500";
    if (percentage >= 70) return "text-yellow-500";
    return "text-green-500";
  };

  const getProgressColor = () => {
    if (isUnlimited) return "bg-green-500";
    if (percentage >= 100) return "bg-red-500";
    if (percentage >= 70) return "bg-yellow-500";
    return "bg-primary";
  };

  const getStatusIcon = () => {
    if (isUnlimited) return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (percentage >= 100) return <AlertCircle className="h-5 w-5 text-red-500" />;
    if (percentage >= 70) return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg bg-primary/10 ${getStatusColor()}`}>
              {icon}
            </div>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="text-xs">{description}</CardDescription>
            </div>
          </div>
          {getStatusIcon()}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className={`text-2xl font-bold ${getStatusColor()}`}>
              {isUnlimited ? "∞" : current}
            </span>
            <span className="text-sm text-muted-foreground">
              {isUnlimited ? "Ilimitado" : `de ${limit} ${unit}`}
            </span>
          </div>
          {!isUnlimited && (
            <>
              <Progress 
                value={Math.min(percentage, 100)} 
                className={`h-2 ${percentage >= 100 ? '[&>div]:bg-red-500' : percentage >= 70 ? '[&>div]:bg-yellow-500' : ''}`}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{Math.round(percentage)}% usado</span>
                {percentage >= 70 && percentage < 100 && (
                  <span className="text-yellow-600 font-medium">Próximo do limite</span>
                )}
                {percentage >= 100 && (
                  <span className="text-red-600 font-medium">Limite atingido</span>
                )}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const FreemiumUsageDashboard = () => {
  const navigate = useNavigate();
  const limits = useFreemiumLimits();

  if (limits.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isOverLimit = !limits.isSubscribed && (
    !limits.canCreateOrder || 
    !limits.canCreatePatient || 
    !limits.canGenerateImage
  );

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className={limits.isSubscribed ? "bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20" : "bg-muted/50"}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {limits.isSubscribed ? (
                  <>
                    <Crown className="h-6 w-6 text-yellow-500" />
                    <span>Plano Premium Ativo</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-6 w-6" />
                    <span>Plano Gratuito</span>
                  </>
                )}
              </CardTitle>
              <CardDescription className="mt-2">
                {limits.isSubscribed 
                  ? "Você tem acesso ilimitado a todos os recursos do sistema"
                  : "Você está utilizando o plano gratuito com recursos limitados"
                }
              </CardDescription>
            </div>
            {!limits.isSubscribed && (
              <Button onClick={() => navigate('/planos')} size="lg" className="gap-2">
                <Crown className="h-4 w-4" />
                Fazer Upgrade
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Alert for over limit */}
      {isOverLimit && (
        <Alert className="border-red-500/50 bg-red-500/10">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <AlertDescription className="text-red-900 dark:text-red-100">
            <strong>Atenção!</strong> Você atingiu o limite de um ou mais recursos. 
            Faça upgrade para continuar usando o sistema sem restrições.
          </AlertDescription>
        </Alert>
      )}

      {/* Usage Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <UsageCard
          title="Pedidos"
          icon={<ShoppingCart className="h-5 w-5" />}
          current={limits.orders?.current || 0}
          limit={limits.orders?.limit || 10}
          percentage={limits.orders?.percentage || 0}
          unit="por mês"
          description="Ordens de trabalho criadas"
          isUnlimited={limits.isSubscribed}
        />

        <UsageCard
          title="Clientes"
          icon={<Users className="h-5 w-5" />}
          current={limits.patients?.current || 0}
          limit={limits.patients?.limit || 10}
          percentage={limits.patients?.percentage || 0}
          unit="cadastros"
          description="Pacientes no sistema"
          isUnlimited={limits.isSubscribed}
        />

        <UsageCard
          title="Gerações IA"
          icon={<Sparkles className="h-5 w-5" />}
          current={limits.imageGenerations?.current || 0}
          limit={limits.imageGenerations?.limit || 5}
          percentage={limits.imageGenerations?.percentage || 0}
          unit="por mês"
          description="Imagens geradas com IA"
          isUnlimited={limits.isSubscribed}
        />
      </div>

      {/* Features Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Recursos do Plano</CardTitle>
          <CardDescription>
            Compare o que está disponível no seu plano atual
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Relatórios em PDF</p>
                  <p className="text-xs text-muted-foreground">
                    Geração e envio de relatórios
                  </p>
                </div>
              </div>
              {limits.isSubscribed ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <Lock className="h-5 w-5 text-muted-foreground" />
              )}
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Armazenamento Ilimitado</p>
                  <p className="text-xs text-muted-foreground">
                    Arquivos e documentos sem limite
                  </p>
                </div>
              </div>
              {limits.isSubscribed ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <Lock className="h-5 w-5 text-muted-foreground" />
              )}
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <Crown className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Suporte Prioritário</p>
                  <p className="text-xs text-muted-foreground">
                    Atendimento com prioridade
                  </p>
                </div>
              </div>
              {limits.isSubscribed ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <Lock className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </div>

          {!limits.isSubscribed && (
            <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-start gap-3">
                <Crown className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="space-y-2 flex-1">
                  <p className="font-semibold text-sm">
                    Desbloqueie todos os recursos com o plano Premium
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pedidos ilimitados, clientes ilimitados, gerações IA ilimitadas, 
                    relatórios completos, armazenamento ilimitado e suporte prioritário.
                  </p>
                  <Button 
                    onClick={() => navigate('/planos')} 
                    className="w-full sm:w-auto mt-2"
                    size="sm"
                  >
                    Ver Planos e Preços
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tips Card */}
      {!limits.isSubscribed && (
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Dicas para aproveitar melhor seu plano
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• O limite de pedidos é resetado todo mês</p>
            <p>• O limite de gerações IA também é mensal</p>
            <p>• Você pode fazer upgrade a qualquer momento</p>
            <p>• Todos os seus dados são mantidos ao fazer upgrade</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
