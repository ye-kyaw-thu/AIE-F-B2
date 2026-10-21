import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveLocale} from '../src/lib/i18n/locale.ts';
import {translate,burmese} from '../src/lib/i18n/messages.ts';
import {SHIPMENT_STATUS_LABELS} from '../src/types/domain.ts';

test('Burmese is the default and unsupported cookie values fail back to Burmese',()=>{
  for(const value of [undefined,'my','fr','<script>','EN'])assert.equal(resolveLocale(value),'my');
  assert.equal(resolveLocale('en'),'en');
});
test('UI translations preserve whitespace and English originals',()=>{
  assert.equal(translate(' Sign out\n','my'),' အကောင့်မှ ထွက်ရန်\n');
  assert.equal(translate('Sign out','en'),'Sign out');
  assert.equal(translate('Cargo\n details','my'),'ကုန်စည် အချက်အလက်');
  assert.equal(translate('Customer entered this note.','my'),'Customer entered this note.');
  assert.equal(translate('constructor','my'),'constructor');
  assert.equal(translate('3 shipments · Approved','my'),'3 ခု · ခွင့်ပြုပြီး');
});
test('all shipment and gate statuses have Unicode Burmese labels without changing stored values',()=>{
  for(const label of [...Object.values(SHIPMENT_STATUS_LABELS),'Open','Delayed','Closed']){
    assert.ok(burmese[label],label);
    assert.match(translate(label,'my'),/[\u1000-\u109f]/);
    assert.equal(translate(label,'en'),label);
  }
});
test('critical auth and request validation messages are translated',()=>{
  for(const label of ['Your passwords do not match.','Enter a valid email address.','Quantity must be greater than zero.','Please check the highlighted fields.'])assert.match(translate(label,'my'),/[\u1000-\u109f]/);
});
