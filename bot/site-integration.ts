import type { Sheet } from '../packages/sheet-engine/index.js';
import type {
  CampaignStatus,
  CampaignRole,
  CampaignEvent,
} from '../packages/campaign-types/index.js';
export type BotCampaign = {
  id: string;
  name: string;
  status: CampaignStatus;
  participants: number;
  role: CampaignRole;
  character: string | null;
  selected: boolean;
};
export type BotCampaignDetail = {
  id: string;
  name: string;
  status: CampaignStatus;
  role: CampaignRole;
  character: string | null;
  participants: { name: string; role: CampaignRole; character: string | null; self: boolean }[];
  events: CampaignEvent[];
};
export type SiteIntegration = {
  pair: (discordId: string, code: string, displayName: string) => Promise<void>;
  character: (discordId: string) => Promise<Sheet>;
  campaigns: (discordId: string) => Promise<BotCampaign[]>;
  campaign: (discordId: string, query?: string) => Promise<BotCampaignDetail>;
  session: (discordId: string, status: CampaignStatus) => Promise<BotCampaignDetail>;
  note: (discordId: string, text: string) => Promise<{ name: string }>;
};
export function createSiteIntegration(origin: string, botToken: string): SiteIntegration {
  const url = new URL('/api/discord/bot', origin);
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new Error('PUBLIC_ORIGIN deve ser uma origem HTTPS válida.');
  async function request(body: unknown) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { authorization: `Bot ${botToken}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new Error('O site não respondeu. Tente novamente em instantes.');
    }
    const data = await response.json().catch(() => null);
    if (!response.ok || !data)
      throw new Error(
        typeof data?.error === 'string'
          ? data.error
          : 'Não foi possível consultar o site. Tente novamente em instantes.',
      );
    return data;
  }
  return {
    pair: async (discordId, code, displayName) => {
      await request({ action: 'pair', discordId, code, displayName });
    },
    character: async (discordId) => (await request({ action: 'character', discordId })).sheet,
    campaigns: async (discordId) => (await request({ action: 'campaigns', discordId })).campaigns,
    campaign: async (discordId, query) =>
      (await request({ action: 'campaign', discordId, query })).campaign,
    session: async (discordId, status) =>
      (await request({ action: 'session', discordId, status })).campaign,
    note: async (discordId, text) => request({ action: 'note', discordId, text }),
  };
}
