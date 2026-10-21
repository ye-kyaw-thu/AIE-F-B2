#!/usr/bin/env python3
"""
Arloo Annotation Tool (Web-Only)
================================
A lightweight, easy-to-setup annotation tool for POLAR dataset extension.

'Arloo' (အာလူး) means 'Potato' in Burmese — inspired by the Potato annotator,
but simpler and easier to set up. 🥔

Install:
  pip install flask pyyaml

Quick Start:
  python arloo.py init
  python arloo.py web --annotator "kyawkyaw" --input sample_texts.txt
  # Then open http://localhost:5000
"""

import argparse
import csv
import json
import os
import sys
import yaml
from pathlib import Path
from datetime import datetime

# =============================================================================
# Default Configuration (embedded for zero-config startup)
# =============================================================================

DEFAULT_CONFIG_YAML = """\
# Arloo Annotation Tool Configuration
# ====================================
# Edit this file to add, remove, or modify annotation fields.
# Field types: auto_id, text, binary
# For text fields: set multiline: true for textarea, false for single-line
# For separator: use ||| to separate multiple values within a field
# For binary fields: optionally set group to organize them in the UI

project:
  name: "POLAR Myanmar Annotation"
  language: "mya"

# ID pattern uses {language}, {annotator}, {index} placeholders
id_pattern: "{language}_{annotator}_{index}"

fields:
  # --- Metadata Fields ---
  - name: id
    type: auto_id
    readonly: true
    description: "Auto-generated unique ID"

  - name: source
    type: text
    multiline: true
    separator: "|||"
    description: "URL or source of the text. Use ||| to separate multiple sources."
    placeholder: "https://example.com/article|||Article title"

  - name: text
    type: text
    multiline: true
    description: "The main text to annotate"
    placeholder: "Enter or paste text here..."

  - name: key_phrase
    type: text
    multiline: true
    separator: "|||"
    description: "Key phrases. Use ||| to separate multiple phrases."
    placeholder: "key-phrase-1|||key-phrase-2|||key-phrase-3"

  # --- Sub-Task 1 & 2: Polarization Type ---
  - name: polarization
    type: binary
    group: "Sub-Task 1 & 2: Polarization Type"

  - name: political
    type: binary
    group: "Sub-Task 1 & 2: Polarization Type"

  - name: racial/ethnic
    type: binary
    group: "Sub-Task 1 & 2: Polarization Type"

  - name: religious
    type: binary
    group: "Sub-Task 1 & 2: Polarization Type"

  - name: gender/sexual
    type: binary
    group: "Sub-Task 1 & 2: Polarization Type"

  - name: other
    type: binary
    group: "Sub-Task 1 & 2: Polarization Type"

  # --- Sub-Task 3: Severity ---
  - name: stereotype
    type: binary
    group: "Sub-Task 3: Severity"

  - name: vilification
    type: binary
    group: "Sub-Task 3: Severity"

  - name: dehumanization
    type: binary
    group: "Sub-Task 3: Severity"

  - name: extreme_language
    type: binary
    group: "Sub-Task 3: Severity"

  - name: lack_of_empathy
    type: binary
    group: "Sub-Task 3: Severity"

  - name: invalidation
    type: binary
    group: "Sub-Task 3: Severity"
"""

SAMPLE_TEXTS = """\
အော် သူ တစ် ယောက် တည်း ဒုက္ခ ပင်လယ်ဝေ နေ တာ နေ မယ် နိုင်ငံရေး က ငါ နဲ့ မ ဆိုင် ဘူး တဲ့ ဘယ်လိုဦးနှောက် နှလုံးသား နဲ့ များ ရှင်သန် ရပ်တည် နေ တယ် မ သိ ။
သူများ ကို မ ပြင် ခင် ကိုယ့် ဟာ ကို လည်း အရင် ပြင် ကြ ဦး 😞
မ ခံစား ရ ပါ စေ နဲ့ လည်း ပြော သေး တယ် ကံ တူ အကျိုး ပေး ပါ စေ တဲ့ ဘာ လား ဟ 🥲
သူ တကယ် ခံစား ရ တာ ပဲ နော်
မြန်မာ့ ယဉ်ကျေး မှု ဖျက် တဲ့ လူစား တွေ အခြား နည်း နဲ့ ပိုက်ဆံ ရှာ ပါ လား
မျိုးရိုး မ ကောင်း တာ ပြင် လို့ ကို မ ရ ဘူး
"""


def load_config(config_path=None):
    """Load YAML config from file, or use embedded default."""
    paths_to_try = []
    if config_path:
        paths_to_try.append(config_path)
    paths_to_try.append("arloo_config.yaml")

    for path in paths_to_try:
        if path and os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                config = yaml.safe_load(f)
                if config and "fields" in config:
                    print(f"📋 Loaded config from: {path}")
                    return config

    # Fall back to embedded default
    return yaml.safe_load(DEFAULT_CONFIG_YAML)


# =============================================================================
# Core Data Manager
# =============================================================================

class AnnotationManager:
    """Manages annotation data: loading, saving, navigation, auto-save."""

    def __init__(self, config, annotator_name="annotator"):
        self.config = config
        self.annotator_name = annotator_name.strip().replace(" ", "-").lower()
        self.language = config.get("project", {}).get("language", "mya")
        self.id_pattern = config.get(
            "id_pattern", "{language}_{annotator}_{index}"
        )
        self.fields = config.get("fields", [])
        self.field_names = [f["name"] for f in self.fields]
        self.data = []
        self.current_index = 0
        self.file_path = None
        self.auto_save_path = None

    # ---- ID Generation ----

    def _generate_id(self, index):
        return self.id_pattern.format(
            language=self.language,
            annotator=self.annotator_name,
            index=index,
        )

    # ---- Record Creation ----

    def _new_record(self):
        record = {}
        for f in self.fields:
            if f["type"] == "binary":
                record[f["name"]] = "0"
            else:
                record[f["name"]] = ""
        return record

    # ---- Loading ----

    def load_from_file(self, file_path):
        """Load from TXT, CSV, TSV, or JSON."""
        self.file_path = file_path
        ext = Path(file_path).suffix.lower()

        # Check for autosave first
        base = str(Path(file_path).with_suffix(""))
        auto_path = base + ".autosave.csv"
        if os.path.exists(auto_path):
            print(f"ℹ️  Found auto-save: {auto_path}")
            print("   Loading from auto-save (your previous work is preserved).")
            self._load_csv(auto_path, ",")
            self.auto_save_path = auto_path
            return

        if ext == ".txt":
            self._load_txt(file_path)
        elif ext == ".csv":
            self._load_csv(file_path, ",")
        elif ext == ".tsv":
            self._load_csv(file_path, "\t")
        elif ext == ".json":
            self._load_json(file_path)
        else:
            raise ValueError(f"Unsupported file format: {ext}")

        self.current_index = 0
        self.auto_save_path = base + ".autosave.csv"

    def _load_txt(self, path):
        self.data = []
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                text = line.strip()
                if not text:
                    continue
                record = self._new_record()
                record["text"] = text
                record["id"] = self._generate_id(len(self.data) + 1)
                self.data.append(record)
        print(f"✅ Loaded {len(self.data)} records from {path}")

    def _load_csv(self, path, delimiter):
        self.data = []
        with open(path, "r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f, delimiter=delimiter)
            for row in reader:
                record = self._new_record()
                for name in self.field_names:
                    if name in row:
                        record[name] = row[name]
                if not record.get("id"):
                    record["id"] = self._generate_id(len(self.data) + 1)
                self.data.append(record)
        print(f"✅ Loaded {len(self.data)} records from {path}")

    def _load_json(self, path):
        with open(path, "r", encoding="utf-8") as f:
            items = json.load(f)
        self.data = []
        for item in items:
            record = self._new_record()
            for name in self.field_names:
                if name in item:
                    record[name] = str(item[name])
            if not record.get("id"):
                record["id"] = self._generate_id(len(self.data) + 1)
            self.data.append(record)
        print(f"✅ Loaded {len(self.data)} records from {path}")

    # ---- Adding ----

    def add_record(self, text=""):
        record = self._new_record()
        record["text"] = text
        record["id"] = self._generate_id(len(self.data) + 1)
        self.data.append(record)
        self.current_index = len(self.data) - 1
        return record

    def delete_record(self, index):
        if 0 <= index < len(self.data):
            del self.data[index]
            if self.current_index >= len(self.data):
                self.current_index = max(0, len(self.data) - 1)
            return True
        return False

    # ---- Navigation ----

    def get_current(self):
        if not self.data:
            return None
        if self.current_index >= len(self.data):
            self.current_index = len(self.data) - 1
        if self.current_index < 0:
            self.current_index = 0
        return self.data[self.current_index]

    def navigate(self, direction):
        new_index = self.current_index + direction
        if 0 <= new_index < len(self.data):
            self.current_index = new_index
            return True
        return False

    def goto(self, index):
        if 0 <= index < len(self.data):
            self.current_index = index
            return True
        return False

    # ---- Updating ----

    def update_field(self, index, field_name, value):
        if 0 <= index < len(self.data):
            self.data[index][field_name] = value

    # ---- Saving ----

    def save(self, file_path, fmt="csv"):
        if fmt == "csv":
            self._save_csv(file_path, ",")
        elif fmt == "tsv":
            self._save_csv(file_path, "\t")
        elif fmt == "json":
            self._save_json(file_path)
        else:
            raise ValueError(f"Unknown format: {fmt}")
        return file_path

    def _save_csv(self, path, delimiter):
        with open(path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(
                f, fieldnames=self.field_names, delimiter=delimiter
            )
            writer.writeheader()
            for record in self.data:
                writer.writerow(record)

    def _save_json(self, path):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)

    def auto_save(self):
        if self.auto_save_path and self.data:
            self._save_csv(self.auto_save_path, ",")
            return self.auto_save_path
        return None

    @property
    def total(self):
        return len(self.data)

    def get_state(self):
        record = self.get_current()
        return {
            "index": self.current_index,
            "total": self.total,
            "record": record,
            "annotator": self.annotator_name,
            "file_path": self.file_path,
        }

    def get_config_json(self):
        return {
            "annotator": self.annotator_name,
            "fields": self.fields,
            "field_names": self.field_names,
            "total": self.total,
            "project": self.config.get("project", {}),
        }


# =============================================================================
# Web Interface (Flask)
# =============================================================================

HTML_PAGE = r"""<!DOCTYPE html>
<html lang="my">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>🥔 Arloo Annotation Tool</title>
<link href="https://fonts.googleapis.com/css2?family=Padauk&family=Noto+Sans:wght@400;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Padauk','Noto Sans',sans-serif;background:#f0f2f5;color:#333;padding:0}
.app{max-width:1100px;margin:0 auto;padding:12px}
/* Header */
.header{background:linear-gradient(135deg,#4a7c59,#2d5a3d);color:#fff;padding:14px 20px;border-radius:10px 10px 0 0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px}
.header h1{font-size:22px;display:flex;align-items:center;gap:8px}
.header .annotator{background:rgba(255,255,255,.15);padding:4px 12px;border-radius:20px;font-size:13px}
/* Toolbar */
.toolbar{background:#fff;padding:10px 16px;border-bottom:2px solid #4a7c59;display:flex;align-items:center;gap:8px;flex-wrap:wrap;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.btn{padding:7px 14px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;transition:all .15s;display:inline-flex;align-items:center;gap:4px}
.btn:active{transform:scale(.96)}
.btn-prev{background:#6c757d;color:#fff}
.btn-next{background:#28a745;color:#fff}
.btn-add{background:#ffc107;color:#333}
.btn-save{background:#007bff;color:#fff}
.btn-del{background:#dc3545;color:#fff}
.btn:hover{opacity:.88;filter:brightness(1.05)}
.line-jump{display:flex;align-items:center;gap:4px;font-size:13px;color:#666}
.line-jump input{width:70px;padding:5px 8px;border:1px solid #ccc;border-radius:5px;font-size:14px;text-align:center}
.progress{font-size:13px;color:#555;font-weight:600;margin-left:auto}
.save-ind{font-size:12px;color:#28a745;min-width:80px}
.save-ind.dirty{color:#ffc107}
/* Content */
.content{background:#fff;padding:20px;border-radius:0 0 10px 10px;box-shadow:0 2px 8px rgba(0,0,0,.06);min-height:400px}
.empty-msg{text-align:center;padding:60px 20px;color:#999;font-size:16px}
/* Text fields */
.field-block{margin-bottom:16px}
.field-label{font-weight:700;font-size:13px;margin-bottom:4px;display:flex;align-items:center;gap:6px;color:#444}
.field-label .hint{font-weight:400;font-size:11px;color:#999;background:#f0f0f0;padding:2px 8px;border-radius:10px}
.field-input{width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:6px;font-size:14px;font-family:inherit;transition:border-color .2s}
.field-input:focus{outline:none;border-color:#4a7c59;box-shadow:0 0 0 2px rgba(74,124,89,.15)}
textarea.field-input{min-height:70px;resize:vertical;line-height:1.6}
textarea.field-input.text-main{min-height:100px;font-size:16px;background:#fffde7;border-color:#ffd54f}
input.field-input[readonly]{background:#f5f5f5;color:#888;cursor:default}
/* Binary groups */
.binary-group{margin-bottom:16px}
.group-title{font-size:13px;font-weight:700;color:#4a7c59;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;padding-bottom:4px;border-bottom:2px solid #e8f0e8}
.toggle-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px}
.toggle{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f5f5f5;border:2px solid #e0e0e0;border-radius:8px;cursor:pointer;transition:all .15s;user-select:none;font-size:14px}
.toggle:hover{background:#e8f5e9;border-color:#a5d6a7}
.toggle.on{background:#c8e6c9;border-color:#4caf50;font-weight:600}
.toggle input{display:none}
.toggle .dot{width:16px;height:16px;border-radius:50%;border:2px solid #ccc;transition:all .15s;flex-shrink:0}
.toggle.on .dot{background:#4caf50;border-color:#388e3c}
/* Responsive */
@media(max-width:600px){.toggle-grid{grid-template-columns:1fr 1fr}.progress{margin-left:0;width:100%}}
</style>
</head>
<body>
<div class="app">
  <div class="header">
    <h1>🥔 Arloo Annotation Tool</h1>
    <span class="annotator">Annotator: <strong id="ann-name">—</strong></span>
  </div>
  <div class="toolbar">
    <button class="btn btn-prev" onclick="nav(-1)">⏮ Prev</button>
    <button class="btn btn-next" onclick="nav(1)">Next ⏭</button>
    <div class="line-jump">Line: <input type="number" id="lineNum" min="1" value="1" onchange="jumpTo()"> / <span id="totalNum">0</span></div>
    <button class="btn btn-add" onclick="addNew()">➕ Add New</button>
    <button class="btn btn-save" onclick="saveAs()">💾 Save As</button>
    <button class="btn btn-del" onclick="delRec()">🗑 Delete</button>
    <span class="progress" id="prog"></span>
    <span class="save-ind" id="saveInd">✓ Saved</span>
  </div>
  <div class="content" id="content">
    <div class="empty-msg">Loading…</div>
  </div>
</div>
<script>
let FIELDS=[],IDX=0,TOTAL=0;
let saveTimer=null,dirty=false;

async function init(){
  const r=await fetch('/api/config');const c=await r.json();
  FIELDS=c.fields;
  document.getElementById('ann-name').textContent=c.annotator;
  await loadState();
}

async function loadState(){
  const r=await fetch('/api/state');const s=await r.json();
  IDX=s.index;TOTAL=s.total;
  document.getElementById('lineNum').value=IDX+1;
  document.getElementById('totalNum').textContent=TOTAL;
  document.getElementById('prog').textContent=TOTAL>0?`${IDX+1} / ${TOTAL}`:'0 / 0';
  render(s.record);
  setDirty(false);
}

function render(rec){
  const c=document.getElementById('content');
  if(!rec){c.innerHTML='<div class="empty-msg">No records yet. Click <b>➕ Add New</b> to start annotating.</div>';return;}
  let html='';

  // Text/auto_id fields
  for(const f of FIELDS){
    if(f.type==='auto_id'||f.type==='text'){
      const val=(rec[f.name]||'').toString();
      const esc=escHtml(val);
      const ro=f.readonly?'readonly':'';
      const hint=f.separator?` <span class="hint">separate with ${f.separator}</span>`:'';
      const ph=f.placeholder?`placeholder="${escHtml(f.placeholder)}"`:'';
      const desc=f.description?` <span class="hint">${escHtml(f.description)}</span>`:'';
      if(f.type==='auto_id'||!f.multiline){
        html+=`<div class="field-block"><label class="field-label">${f.name}${desc}</label><input type="text" class="field-input" value="${esc}" ${ro} ${ph} data-f="${f.name}" oninput="onText(this)"></div>`;
      }else{
        const mainCls=f.name==='text'?' text-main':'';
        html+=`<div class="field-block"><label class="field-label">${f.name}${desc}${hint}</label><textarea class="field-input${mainCls}" ${ro} ${ph} data-f="${f.name}" oninput="onText(this)">${esc}</textarea></div>`;
      }
    }
  }

  // Binary fields grouped
  const bins=FIELDS.filter(f=>f.type==='binary');
  if(bins.length){
    const groups={};
    for(const f of bins){const g=f.group||'Labels';(groups[g]=groups[g]||[]).push(f);}
    for(const[gname,fs]of Object.entries(groups)){
      html+=`<div class="binary-group"><div class="group-title">${escHtml(gname)}</div><div class="toggle-grid">`;
      for(const f of fs){
        const on=rec[f.name]==='1'||rec[f.name]===1;
        html+=`<label class="toggle${on?' on':''}" id="tg_${f.name}"><input type="checkbox" ${on?'checked':''} onchange="onBin('${f.name}',this.checked)"><span class="dot"></span>${escHtml(f.name)}</label>`;
      }
      html+='</div></div>';
    }
  }
  c.innerHTML=html;
}

function escHtml(t){const d=document.createElement('div');d.textContent=t;return d.innerHTML;}

async function onText(el){
  const f=el.dataset.f;
  await fetch('/api/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({index:IDX,field:f,value:el.value})});
  setDirty(true);
}

async function onBin(name,checked){
  const val=checked?'1':'0';
  const tg=document.getElementById('tg_'+name);
  if(checked)tg.classList.add('on');else tg.classList.remove('on');
  await fetch('/api/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({index:IDX,field:name,value:val})});
  setDirty(true);
}

function setDirty(d){
  dirty=d;
  const el=document.getElementById('saveInd');
  if(d){el.textContent='⏳ Unsaved…';el.classList.add('dirty');}
  else{el.textContent='✓ Saved';el.classList.remove('dirty');}
  if(d){
    if(saveTimer)clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>doAutoSave(),2000);
  }
}

async function doAutoSave(){
  const r=await fetch('/api/autosave',{method:'POST'});
  if(r.ok)setDirty(false);
}

async function nav(dir){
  await fetch('/api/navigate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({direction:dir})});
  await loadState();
}

async function jumpTo(){
  const n=parseInt(document.getElementById('lineNum').value);
  if(isNaN(n)||n<1||n>TOTAL){alert('Line out of range. Valid: 1-'+TOTAL);document.getElementById('lineNum').value=IDX+1;return;}
  await fetch('/api/goto',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({index:n-1})});
  await loadState();
}

async function addNew(){
  await fetch('/api/add',{method:'POST'});
  await loadState();
  document.querySelector('[data-f="text"]')?.focus();
}

async function delRec(){
  if(!confirm('Delete current record? This cannot be undone.'))return;
  await fetch('/api/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({index:IDX})});
  await loadState();
}

async function saveAs(){
  const fmt=prompt('Format (csv / tsv / json):','csv');if(!fmt)return;
  const name=prompt('File name (without extension):','annotations');if(!name)return;
  const r=await fetch(`/api/save?format=${fmt}&name=${encodeURIComponent(name)}`,{method:'POST'});
  const d=await r.json();
  if(d.path)alert('✅ Saved to:\n'+d.path);
  else alert('❌ Error: '+(d.error||'unknown'));
  setDirty(false);
}

// Keyboard shortcuts
document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'){
    if(e.ctrlKey&&e.key==='s'){e.preventDefault();saveAs();}
    return;
  }
  if(e.key==='ArrowLeft')nav(-1);
  if(e.key==='ArrowRight')nav(1);
});

init();
</script>
</body>
</html>"""


def run_web(manager, host="127.0.0.1", port=5000):
    """Run the Flask web interface."""
    try:
        from flask import Flask, request, jsonify, Response
    except ImportError:
        print("❌ Flask is not installed.")
        print("   Install with:  pip install flask")
        sys.exit(1)

    app = Flask(__name__)
    app.config["JSON_AS_ASCII"] = False

    @app.route("/")
    def index():
        return Response(HTML_PAGE, mimetype="text/html")

    @app.route("/api/config")
    def api_config():
        return jsonify(manager.get_config_json())

    @app.route("/api/state")
    def api_state():
        return jsonify(manager.get_state())

    @app.route("/api/navigate", methods=["POST"])
    def api_navigate():
        data = request.get_json()
        manager.navigate(data["direction"])
        manager.auto_save()
        return jsonify(manager.get_state())

    @app.route("/api/goto", methods=["POST"])
    def api_goto():
        data = request.get_json()
        manager.goto(data["index"])
        manager.auto_save()
        return jsonify(manager.get_state())

    @app.route("/api/update", methods=["POST"])
    def api_update():
        data = request.get_json()
        manager.update_field(data["index"], data["field"], data["value"])
        return jsonify({"ok": True})

    @app.route("/api/add", methods=["POST"])
    def api_add():
        manager.add_record()
        manager.auto_save()
        return jsonify(manager.get_state())

    @app.route("/api/delete", methods=["POST"])
    def api_delete():
        data = request.get_json()
        manager.delete_record(data["index"])
        manager.auto_save()
        return jsonify(manager.get_state())

    @app.route("/api/autosave", methods=["POST"])
    def api_autosave():
        path = manager.auto_save()
        return jsonify({"ok": True, "path": path})

    @app.route("/api/save", methods=["POST"])
    def api_save():
        fmt = request.args.get("format", "csv")
        name = request.args.get("name", "annotations")
        ext = fmt if fmt in ("csv", "tsv", "json") else "csv"
        filename = f"{name}.{ext}"
        path = os.path.join(os.getcwd(), filename)
        try:
            manager.save(path, ext)
            return jsonify({"ok": True, "path": path})
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 500

    print(f"\n{'='*50}")
    print(f"  🥔 Arloo Annotation Tool (Web Mode)")
    print(f"{'='*50}")
    print(f"  Annotator : {manager.annotator_name}")
    print(f"  Records   : {manager.total}")
    if manager.file_path:
        print(f"  Input file: {manager.file_path}")
    print(f"  URL       : http://{host}:{port}")
    print(f"{'='*50}")
    print(f"  Press Ctrl+C to stop.\n")

    # Auto-open browser
    try:
        import webbrowser
        webbrowser.open(f"http://{host}:{port}")
    except Exception:
        pass

    app.run(host=host, port=port, debug=False, use_reloader=False)


# =============================================================================
# Init Command
# =============================================================================

def init_project():
    """Create sample config and text files."""
    config_path = "arloo_config.yaml"
    texts_path = "sample_texts.txt"

    if os.path.exists(config_path):
        print(f"⚠️  {config_path} already exists. Skipping.")
    else:
        with open(config_path, "w", encoding="utf-8") as f:
            f.write(DEFAULT_CONFIG_YAML)
        print(f"✅ Created: {config_path}")

    if os.path.exists(texts_path):
        print(f"⚠️  {texts_path} already exists. Skipping.")
    else:
        with open(texts_path, "w", encoding="utf-8") as f:
            f.write(SAMPLE_TEXTS)
        print(f"✅ Created: {texts_path}")

    print(f"\n📋 Next steps:")
    print(f"   1. Edit {config_path} to customize fields (optional)")
    print(f"   2. Add your texts to {texts_path} (one per line)")
    print(f"   3. Run: python arloo.py web --annotator \"your-name\" --input {texts_path}")
    print(f"   4. Open http://localhost:5000 in your browser\n")


# =============================================================================
# Main Entry Point
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="🥔 Arloo Annotation Tool — Lightweight POLAR dataset annotator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python arloo.py init
  python arloo.py web --annotator "kyawkyaw" --input sample_texts.txt
  python arloo.py web --annotator "kyawkyaw" --input data.csv --port 8080
  python arloo.py web --annotator "kyawkyaw"  # Start empty, add sentences interactively
        """,
    )

    subparsers = parser.add_subparsers(dest="mode", help="Operation mode")

    # Web mode
    web_parser = subparsers.add_parser("web", help="Run web interface (Flask)")
    web_parser.add_argument("--annotator", "-a", required=True, help="Annotator name (e.g., 'kyawkyaw')")
    web_parser.add_argument("--input", "-i", help="Input file (TXT/CSV/TSV/JSON). If omitted, start empty.")
    web_parser.add_argument("--config", "-c", help="Custom YAML config file path")
    web_parser.add_argument("--host", default="127.0.0.1", help="Host (default: 127.0.0.1, use 0.0.0.0 for network)")
    web_parser.add_argument("--port", "-p", type=int, default=5000, help="Port (default: 5000)")

    # Init mode
    init_parser = subparsers.add_parser("init", help="Create sample config and text files")

    args = parser.parse_args()

    if args.mode is None:
        parser.print_help()
        sys.exit(0)

    if args.mode == "init":
        init_project()
        return

    # Load config
    config = load_config(getattr(args, "config", None))

    # Create manager
    manager = AnnotationManager(config, annotator_name=args.annotator)

    # Load input file if provided
    if args.input:
        if not os.path.exists(args.input):
            print(f"❌ File not found: {args.input}")
            sys.exit(1)
        manager.load_from_file(args.input)

    # Run in requested mode
    if args.mode == "web":
        run_web(manager, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
  