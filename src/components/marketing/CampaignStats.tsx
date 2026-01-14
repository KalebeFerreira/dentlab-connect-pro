import { Card, CardContent } from "@/components/ui/card";
import { Megaphone, Eye, MousePointer, Users, DollarSign } from "lucide-react";

interface CampaignStatsProps {
  stats: {
    impressions: number;
    clicks: number;
    conversions: number;
    spent: number;
  };
  campaignCount: number;
}

export const CampaignStats = ({ stats, campaignCount }: CampaignStatsProps) => {
  const ctr = stats.impressions > 0 
    ? ((stats.clicks / stats.impressions) * 100).toFixed(1) 
    : "0";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Megaphone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{campaignCount}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Campanhas</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Eye className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.impressions.toLocaleString()}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Impressões</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <MousePointer className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.clicks.toLocaleString()}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Cliques ({ctr}%)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Users className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.conversions}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Conversões</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="col-span-2 sm:col-span-1">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <DollarSign className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">R$ {stats.spent.toFixed(0)}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Investido</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
