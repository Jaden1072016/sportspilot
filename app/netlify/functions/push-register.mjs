import {jsonResponse} from '../../lib/http.mjs';
export default async()=>jsonResponse({ok:false,enabled:false,reason:'Background push NOT implemented in starter. Requires persistent subscription storage, VAPID signing, approved polling schedule, rate-limit plan, and integration tests. In-app alerts only.'},501);
