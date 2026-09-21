import sys

def extract_features(tokens, idx):
    # tokens is a list of (word, tag) tuples
    features = {}
    
    # Current word feature (using a simple hash or vocabulary index)
    curr_word, curr_tag = tokens[idx]
    features[f"w0_{curr_word}"] = 1
    
    # Context: Previous word
    if idx > 0:
        prev_word, _ = tokens[idx - 1]
        features[f"wm1_{prev_word}"] = 1
    else:
        features["wm1_BOS"] = 1
        
    # Context: Next word
    if idx < len(tokens) - 1:
        next_word, _ = tokens[idx + 1]
        features[f"wp1_{next_word}"] = 1
    else:
        features["wp1_EOS"] = 1
        
    return curr_tag, features

def process_file(input_path, output_path, vocab=None, tag_map=None):
    if vocab is None:
        vocab = {}
        tag_map = {}
        is_train = True
    else:
        is_train = False

    dataset = []
    with open(input_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            
            # Split sentence into word/tag tokens
            raw_tokens = line.split()
            sentence = []
            for token in raw_tokens:
                # Handle potential malformed tokens safely
                if '/' in token:
                    parts = token.rsplit('/', 1)
                    word, tag = parts[0], parts[1]
                    sentence.append((word, tag))
            
            for i in range(len(sentence)):
                tag, feats = extract_features(sentence, i)
                
                if is_train:
                    if tag not in tag_map:
                        tag_map[tag] = len(tag_map) + 1
                    
                    vector = []
                    for fname in feats:
                        if fname not in vocab:
                            vocab[fname] = len(vocab) + 1
                        vector.append(vocab[fname])
                else:
                    vector = [vocab[fname] for fname in feats if fname in vocab]
                
                if tag in tag_map:
                    label = tag_map[tag]
                    # Sort feature indices as required by TinySVM
                    vector = sorted(list(set(vector)))
                    dataset.append((label, vector))


    with open(output_path, 'w', encoding='utf-8') as out:
        for label, vector in dataset:
            # Strip, cast to int cleanly, and filter out empty vector indices
            int_label = int(float(label))
            valid_vector = sorted(list(set(int(idx) for idx in vector if idx > 0)))
            feat_str = " " .join([f"{idx}:1" for idx in valid_vector])
            out.write(f"{int_label} {feat_str}\n")

    return vocab, tag_map

# Run conversion for train and test sets
if __name__ == "__main__":
    vocab, tag_map = process_file("mypos-ver.3.0.shuf.nopipe.txt", "train.svm")
    process_file("otest.1k.nopipe.txt", "test.svm", vocab, tag_map)
    print("Conversion completed! Generated train.svm and test.svm")
