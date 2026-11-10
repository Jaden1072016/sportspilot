import { jsonResponse } from '../../lib/http.mjs';
export default async () => jsonResponse({ ok: true, product: 'SportsPilot', version: '0.4.0', mode: 'RESEARCH_ONLY', tradingEnabled: false, realMoneyAlertsEnabled: false, providerKeysRequired: false, models: ['NBA-PREGAME-v1.0', 'NBA-LIVE-v1.0', 'NBA-PROPS-v1.0'], backgroundAlerts: true, timestamp: new Date().toISOString() });
