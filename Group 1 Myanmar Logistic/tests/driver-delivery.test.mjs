import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deliverDriverInvitation} from '../src/lib/drivers/invitation-delivery.ts';
const record={id:'invite-id',email:'driver@test.invalid',full_name:'Ko Aung',driver_id:'driver-id'},target='https://example.com/auth/callback';
function ports(overrides={}){const calls=[];return {calls,api:{
  getUser:async id=>{calls.push(['lookup',id]);return {data:{user:{id,email:record.email,email_confirmed_at:'2026-09-19'}},error:null};},
  sendRecovery:async (...args)=>{calls.push(['recovery',...args]);return {error:null};},
  sendInvite:async (...args)=>{calls.push(['invite',...args]);return {data:{user:{id:'driver-id'}},error:null};},
  finalize:async (...args)=>{calls.push(['finalize',...args]);return {error:null};},...overrides}};}
test('confirmed invited Driver gets a recovery email without reinviting or converting account',async()=>{
  const {calls,api}=ports();const result=await deliverDriverInvitation(record,target,api);
  assert.equal(result.success,true);assert.match(result.message,/password setup/);
  assert.deepEqual(calls,[['lookup','driver-id'],['recovery',record.email,target]]);
});
test('new invitation sends email then finalizes only the returned identity',async()=>{
  const {calls,api}=ports();assert.equal((await deliverDriverInvitation({...record,driver_id:null},target,api)).success,true);
  assert.deepEqual(calls,[['invite',record.email,record.full_name,target],['finalize','invite-id','driver-id']]);
});
test('mismatched identity refuses delivery and provider failures never claim success',async()=>{
  const {calls,api}=ports({getUser:async()=>({data:{user:{id:'wrong-id',email:record.email,email_confirmed_at:'2026-09-19'}},error:null})});
  assert.equal((await deliverDriverInvitation(record,target,api)).success,undefined);assert.deepEqual(calls,[]);
  const failed=ports({sendRecovery:async()=>({error:{status:429}})});
  assert.match((await deliverDriverInvitation(record,target,failed.api)).message,/Too many attempts/);
  const inviteFailed=ports({sendInvite:async()=>({data:{user:null},error:{status:500}})});
  assert.equal((await deliverDriverInvitation({...record,driver_id:null},target,inviteFailed.api)).success,undefined);
  assert.ok(!inviteFailed.calls.some(call=>call[0]==='finalize'));
  const finalizeFailed=ports({finalize:async()=>({error:{code:'42501'}})});
  assert.match((await deliverDriverInvitation({...record,driver_id:null},target,finalizeFailed.api)).message,/could not be prepared/);
});
