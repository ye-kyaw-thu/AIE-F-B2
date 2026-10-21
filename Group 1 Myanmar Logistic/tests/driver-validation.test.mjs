import {test} from 'node:test';
import assert from 'node:assert/strict';
import {driverInviteSchema,driverPasswordSchema} from '../src/lib/drivers/validation.ts';
import {profileDestination} from '../src/lib/auth/destination.ts';
test('invitation validates contact details and normalizes identity',()=>{
  assert.deepEqual(driverInviteSchema.parse({fullName:'  Ko Aung  ',email:' AUNG@example.com ',phone:'+95 9 123456789'}),{fullName:'Ko Aung',email:'aung@example.com',phone:'+95 9 123456789'});
  for(const fields of [{email:'bad'},{fullName:'A'},{phone:'<script>'}])assert.equal(driverInviteSchema.safeParse({fullName:'Ko Aung',email:'aung@example.com',phone:'',...fields}).success,false);
});
test('password setup rejects short or mismatched passwords',()=>{
  assert.equal(driverPasswordSchema.safeParse({password:'long unique phrase',confirmPassword:'long unique phrase'}).success,true);
  for(const fields of [{password:'short',confirmPassword:'short'},{password:'long unique phrase',confirmPassword:'different'}])assert.equal(driverPasswordSchema.safeParse(fields).success,false);
});
test('incomplete or disabled Drivers cannot land in operational dashboards',()=>{
  assert.equal(profileDestination({role:'driver',driver_access:'invited'}),'/auth/driver-setup');
  assert.equal(profileDestination({role:'driver',driver_access:'disabled'}),'/account/disabled');
  for(const role of ['admin','driver','trader'])assert.equal(profileDestination({role,driver_access:'active'}),`/${role}/dashboard`);
});
