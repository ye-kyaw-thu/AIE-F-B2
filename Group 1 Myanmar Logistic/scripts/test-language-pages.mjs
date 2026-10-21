import assert from 'node:assert/strict';
const origin=new URL(process.env.TEST_APP_URL||'http://127.0.0.1:3100');
assert.ok(['localhost','127.0.0.1'].includes(origin.hostname));
for(const [path,my,en] of [['/','ကုန်ပို့မှုတိုင်းအတွက်။','Every shipment.'],['/login','အီးမေးလ်လိပ်စာ','Email address'],['/signup','ကုန်သည်အကောင့် ဖွင့်ရန်','Create Trader account']]){
  for(const [cookie,locale,expected] of [['','my',my],['logistics-language=my','my',my],['logistics-language=en','en',en],['logistics-language=invalid','my',my]]){
    const response=await fetch(new URL(path,origin),{headers:cookie?{Cookie:cookie}:{}});
    assert.equal(response.status,200);
    const html=await response.text();
    assert.ok(html.includes(`<html lang="${locale}"`),`${path}: wrong document locale`);
    assert.ok(html.includes(expected),`${path}: missing ${locale} label`);
    assert.ok(html.includes('class="language-switch"'),`${path}: no language switch`);
    assert.ok(html.includes('lang="my" aria-pressed="'+(locale==='my')+'"'),`${path}: wrong selected language`);
    if(path==='/signup'&&locale==='my')assert.ok(html.includes('placeholder="သင့်အမည်အပြည့်အစုံ"'));
  }
}
console.log('PASS: Burmese default, English preference, invalid-locale fallback, translated forms and selected language controls render correctly.');
