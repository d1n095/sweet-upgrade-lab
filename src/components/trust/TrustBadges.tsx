import { Shield, Star, Zap, Award, Crown, Gem } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TrustBadgesProps {
  level: number;
  trustScore: number;
  xp: number;
  compact?: boolean;
}

const getBadges = (level: number, trustScore: number, xp: number) => {
  const badges: { icon: React.ReactNode; label: string; color: string; unlocked: boolean }[] = [
    { icon: <Star className="w-3.5 h-3.5" />, label: 'Ny medlem', color: 'bg-blue-500/10 text-blue-600', unlocked: true },
    { icon: <Shield className="w-3.5 h-3.5" />, label: 'Verifierad', color: 'bg-green-500/10 text-green-600', unlocked: trustScore >= 10 },
    { icon: <Zap className="w-3.5 h-3.5" />, label: 'Aktiv', color: 'bg-yellow-500/10 text-yellow-600', unlocked: xp >= 100 },
    { icon: <Award className="w-3.5 h-3.5" />, label: 'Engagerad', color: 'bg-purple-500/10 text-purple-600', unlocked: level >= 5 },
    { icon: <Crown className="w-3.5 h-3.5" />, label: 'Trogen kund', color: 'bg-orange-500/10 text-orange-600', unlocked: level >= 10 },
    { icon: <Gem className="w-3.5 h-3.5" />, label: 'VIP', color: 'bg-primary/10 text-primary', unlocked: level >= 20 },
  ];
  return badges;
};

const TrustBadges = ({ level, trustScore, xp, compact = false }: TrustBadgesProps) => {
  const badges = getBadges(level, trustScore, xp);
  const unlockedBadges = badges.filter(b => b.unlocked);

  if (compact) {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        <TooltipProvider>
          {unlockedBadges.map((badge, i) => (
            <Tooltip key={i}>
              <TooltipTrigger>
                <Badge className={`${badge.color} text-[10px] px-1.5 py-0.5`}>
                  {badge.icon}
                </Badge>
              </TooltipTrigger>
              <TooltipContent><p>{badge.label}</p></TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Trust Badges</h3>
      <div className="grid grid-cols-3 gap-2">
        {badges.map((badge, i) => (
          <div
            key={i}
            className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-center transition-all ${
              badge.unlocked
                ? 'border-border bg-card'
                : 'border-dashed border-muted bg-muted/30 opacity-40'
            }`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${badge.unlocked ? badge.color : 'bg-muted text-muted-foreground'}`}>
              {badge.icon}
            </div>
            <span className="text-[10px] font-medium leading-tight">{badge.label}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Shield className="w-3.5 h-3.5" />
        <span>Trust Score: {trustScore}/100</span>
      </div>
    </div>
  );
};

export default TrustBadges;
