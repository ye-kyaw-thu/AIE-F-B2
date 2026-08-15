import csv
import hashlib
import json
import re
import urllib.request

MYPOS_CORPUS_URL = "https://raw.githubusercontent.com/ye-kyaw-thu/myPOS/master/corpus/mypos-ver1.0.txt"

def generate_mya_id(text: str) -> str:
    """Generates a POLAR-compliant unique MD5 ID prefixed with 'mya_'."""
    clean_bytes = text.strip().encode('utf-8')
    return f"mya_{hashlib.md5(clean_bytes).hexdigest()}"

def clean_and_segment(text: str) -> str:
    """Removes hidden zero-width spaces and normalizes Burmese word spaces."""
    text = re.sub(r'[\u200b\u200c\u200d\uFEFF\xa0]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def build_full_600_dataset():
    unique_sentences = []

    print("[INFO] Fetching 600 real-world Burmese sentences from open-source corpus...")
    try:
        req = urllib.request.Request(MYPOS_CORPUS_URL, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            raw_text = response.read().decode('utf-8')
            for line in raw_text.splitlines():
                # Strip POS tags (word/TAG -> word)
                words = [item.split('/')[0] for item in line.split() if item]
                clean_sentence = clean_and_segment(" ".join(words))
                if len(clean_sentence) > 12 and clean_sentence not in unique_sentences:
                    unique_sentences.append(clean_sentence)
                if len(unique_sentences) >= 600:
                    break
    except Exception as e:
        print(f"[ERROR] Failed to fetch data: {e}")
        return

    potato_json = []
    csv_rows = []

    for text in unique_sentences[:600]:
        mya_id = generate_mya_id(text)
        potato_json.append({"id": mya_id, "text": text})
        
        # POLAR CSV Schema: [mya_id, text, L1, L2, L3, L4, L5, L6, keywords]
        csv_rows.append([mya_id, text, 0, 0, 0, 0, 0, 0, "NULL"])

    # Save data.json for Potato UI
    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(potato_json, f, ensure_ascii=False, indent=2)

    # Save final dataset output CSV
    with open("final_dataset_output.csv", "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerows(csv_rows)

    print(f"[SUCCESS] Exported 'data.json' and 'final_dataset_output.csv' with exactly {len(csv_rows)} records!")

if __name__ == "__main__":
    build_full_600_dataset()