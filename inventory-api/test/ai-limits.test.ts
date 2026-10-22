import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aiLimitMessage} from '../src/ai-limits.js';
test('exhausted credits are explained as billing rather than temporary throttling',()=>{
 const message=aiLimitMessage({error:{code:'credit_balance_exhausted',type:'insufficient_quota'}},null);
 assert.match(message,/credits are exhausted/);assert.match(message,/Billing/);assert.doesNotMatch(message,/temporarily rate limited/);
});
test('specific spending limits override broad insufficient quota errors',()=>{
 for(const code of ['project_spend_limit_exceeded','organization_spend_limit_exceeded'])assert.match(aiLimitMessage({error:{code,type:'insufficient_quota'}},null),/spending limit/);
 assert.match(aiLimitMessage({error:{code:'organization_usage_limit_exceeded',type:'insufficient_quota'}},null),/approved usage limit/);
});
test('legacy and broad quota errors are actionable without encouraging repeated retries',()=>{
 assert.match(aiLimitMessage({error:{code:'insufficient_quota'}},null),/no available quota/);
 assert.match(aiLimitMessage({error:{type:'insufficient_quota',code:null}},null),/no available quota/);
});
test('genuine rate limits include a valid provider retry delay',()=>{
 assert.match(aiLimitMessage({error:{code:'rate_limit_exceeded'}},'45'),/45 seconds/);
 assert.match(aiLimitMessage({error:{type:'rate_limit_error',code:'slow_down'}},null),/temporarily rate limited/);
});
test('unknown errors and provider details do not produce misleading or unsafe messages',()=>{
 const message=aiLimitMessage({error:{code:'unknown',message:'Sensitive provider details'}},'<script>');
 assert.match(message,/usage-limit/);assert.doesNotMatch(message,/Sensitive|script|temporarily/);
 assert.match(aiLimitMessage(null,null),/usage-limit/);
});
