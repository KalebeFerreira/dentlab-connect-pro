import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Brain, AlertTriangle, CheckCircle, Lightbulb } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Appointment {
  id: string;
  appointment_date: string;
  patient_name?: string;
  procedure_type?: string;
  type: string;
  duration_minutes: number;
  status: string;
}

interface ScheduleAnalyzerProps {
  appointments: Appointment[];
  dentistName?: string;
}

export const ScheduleAnalyzer = ({ appointments, dentistName }: ScheduleAnalyzerProps) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);

  const analyzeSchedule = async () => {
    if (appointments.length === 0) {
      toast.error('Nenhum agendamento para analisar');
      return;
    }

    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-schedule', {
        body: { 
          appointments: appointments.map(apt => ({
            appointment_date: apt.appointment_date,
            patient_name: apt.patient_name,
            procedure_type: apt.procedure_type,
            type: apt.type,
            duration_minutes: apt.duration_minutes,
            status: apt.status,
          })),
          dentistName 
        },
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setAnalysis(data.analysis);
      toast.success('Análise concluída!');
    } catch (error: any) {
      console.error('Erro ao analisar agenda:', error);
      toast.error('Erro ao analisar agenda. Tente novamente.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatAnalysis = (text: string) => {
    const sections = text.split(/(?=CONFLITOS|ALERTAS|SUGESTÕES)/gi);
    
    return sections.map((section, index) => {
      const isConflict = section.toLowerCase().includes('conflito');
      const isAlert = section.toLowerCase().includes('alerta');
      const isSuggestion = section.toLowerCase().includes('sugest');

      let icon = <CheckCircle className="h-5 w-5 text-green-500" />;
      let bgColor = 'bg-green-50 dark:bg-green-950/20';
      let borderColor = 'border-green-200 dark:border-green-800';

      if (isConflict) {
        icon = <AlertTriangle className="h-5 w-5 text-red-500" />;
        bgColor = 'bg-red-50 dark:bg-red-950/20';
        borderColor = 'border-red-200 dark:border-red-800';
      } else if (isAlert) {
        icon = <AlertTriangle className="h-5 w-5 text-yellow-500" />;
        bgColor = 'bg-yellow-50 dark:bg-yellow-950/20';
        borderColor = 'border-yellow-200 dark:border-yellow-800';
      } else if (isSuggestion) {
        icon = <Lightbulb className="h-5 w-5 text-blue-500" />;
        bgColor = 'bg-blue-50 dark:bg-blue-950/20';
        borderColor = 'border-blue-200 dark:border-blue-800';
      }

      return (
        <div 
          key={index} 
          className={`p-4 rounded-lg border ${bgColor} ${borderColor} mb-3`}
        >
          <div className="flex items-start gap-3">
            {icon}
            <div className="whitespace-pre-wrap text-sm">{section.trim()}</div>
          </div>
        </div>
      );
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          Análise Inteligente da Agenda
        </CardTitle>
        <CardDescription>
          Identifique conflitos e receba sugestões de otimização com IA
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={analyzeSchedule} 
          disabled={isAnalyzing || appointments.length === 0}
          className="w-full"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analisando agenda...
            </>
          ) : (
            <>
              <Brain className="mr-2 h-4 w-4" />
              Analisar Agenda ({appointments.length} agendamentos)
            </>
          )}
        </Button>

        {analysis && (
          <div className="mt-4 space-y-2">
            {formatAnalysis(analysis)}
          </div>
        )}

        {!analysis && !isAnalyzing && appointments.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum agendamento disponível para análise.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
