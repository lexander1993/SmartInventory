import {z} from 'zod';
const providerError=z.object({error:z.object({code:z.string().nullable().optional(),type:z.string().nullable().optional()}).passthrough()}).passthrough();
export function aiLimitMessage(detail:unknown,retryAfter:string|null){
 const parsed=providerError.safeParse(detail);const error=parsed.success?parsed.data.error:undefined;
 // Specific billing codes take precedence over the broader insufficient_quota type.
 const billing:Record<string,string>={
  credit_balance_exhausted:'Your OpenAI API credits are exhausted. Add credits in OpenAI API Billing before trying again. Waiting a minute will not resolve this.',
  project_spend_limit_exceeded:'Your OpenAI API project has reached its spending limit. Review the project limit or wait until it resets before trying again.',
  organization_spend_limit_exceeded:'Your OpenAI API organization has reached its spending limit. Review the organization limit or wait until it resets before trying again.',
  organization_usage_limit_exceeded:'Your OpenAI API organization has reached its approved usage limit. Contact the organization owner or OpenAI support before trying again.',
  usage_limit_exceeded:'Your OpenAI API account has reached a billing or usage limit. Check API billing and usage limits before trying again.'
 };
 if(error?.code && Object.hasOwn(billing,error.code))return billing[error.code];
 if(error?.code==='insufficient_quota' || error?.type==='insufficient_quota')return 'Your OpenAI API project has no available quota. Check API billing, credits, and spending limits before trying again.';
 if(error?.code==='rate_limit_exceeded' || error?.code==='slow_down' || error?.type==='rate_limit_error'){
  const seconds=retryAfter && /^\d+$/.test(retryAfter)?Number(retryAfter):null;
  return 'The AI service is temporarily rate limited. '+(seconds && seconds<=86400?'Wait at least '+seconds+' seconds before trying again.':'Wait before trying again.');
 }
 return 'OpenAI rejected this request with a usage-limit error. Check API billing and usage limits before trying again.';
}
