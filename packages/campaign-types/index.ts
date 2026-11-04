export type CampaignRole = 'dm' | 'player';
export type CampaignStatus = 'lobby' | 'active' | 'paused' | 'closed';
export type CampaignParticipant = {
  id: string;
  name: string;
  role: CampaignRole;
  online: boolean;
  joinedAt: string;
  character?: {
    name: string;
    revision: number;
    updatedAt: string;
    skills: number;
    unlocked: number;
  };
};
export type CampaignEvent = {
  id: string;
  kind: 'message' | 'status' | 'system';
  author: string;
  body: string;
  createdAt: string;
};
export type CampaignState = {
  id: string;
  name: string;
  status: CampaignStatus;
  participants: CampaignParticipant[];
  events: CampaignEvent[];
  createdAt: string;
  revoked: boolean;
};

export const campaignStatusLabels: Record<CampaignStatus, string> = {
  lobby: 'Aguardando jogadores',
  active: 'Em andamento',
  paused: 'Pausada',
  closed: 'Encerrada',
};
