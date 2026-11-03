export type CampaignRole = 'dm' | 'player';
export type CampaignStatus = 'lobby' | 'active' | 'paused' | 'closed';
export type CampaignParticipant = {
  id: string;
  name: string;
  role: CampaignRole;
  online: boolean;
  joinedAt: string;
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
