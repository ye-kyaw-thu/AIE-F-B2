#!/usr/bin/env python3
import time
import pickle
from sklearn.feature_extraction import DictVectorizer
from sklearn.svm import LinearSVC
from sklearn.metrics import classification_report, accuracy_score

def load_conll_data(filepath):
    sentences = []
    current_sentence = []
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                if current_sentence:
                    sentences.append(current_sentence)
                    current_sentence = []
                continue
            parts = line.split('\t')
            if len(parts) == 2:
                current_sentence.append((parts[0], parts[1]))
        if current_sentence:
            sentences.append(current_sentence)
    return sentences

def extract_features_and_labels(sentences):
    X, y = [], []
    for sent in sentences:
        for i, (word, tag) in enumerate(sent):
            # Define local context features
            features = {
                'word': word,
                'prefix_1': word[:1],
                'prefix_2': word[:2],
                'suffix_1': word[-1:],
                'suffix_2': word[-2:],
                'is_first': i == 0,
                'is_last': i == len(sent) - 1,
            }
            
            # Previous word context
            if i > 0:
                features['prev_word'] = sent[i - 1][0]
                features['prev_tag'] = sent[i - 1][1] # Note: in real inference we use predicted, but gold standard or word context helps
            else:
                features['prev_word'] = '<BOS>'
                
            # Next word context
            if i < len(sent) - 1:
                features['next_word'] = sent[i + 1][0]
            else:
                features['next_word'] = '<EOS>'
                
            X.append(features)
            y.append(tag)
    return X, y

def main():
    print("[1/4] Loading training and test data...")
    train_sents = load_conll_data("./data/train.conll")
    test_sents = load_conll_data("./data/test.conll")
    
    print(f"Loaded {len(train_sents)} training sentences and {len(test_sents)} test sentences.")

    print("[2/4] Extracting features...")
    X_train_dicts, y_train = extract_features_and_labels(train_sents)
    X_test_dicts, y_test = extract_features_and_labels(test_sents)

    print("[3/4] Vectorizing features with DictVectorizer...")
    vectorizer = DictVectorizer(sparse=True)
    X_train = vectorizer.fit_transform(X_train_dicts)
    X_test = vectorizer.transform(X_test_dicts)
    
    print(f"Feature matrix shape (Train): {X_train.shape}")
    print(f"Feature matrix shape (Test):  {X_test.shape}")

    print("[4/4] Training LinearSVC model...")
    start_time = time.time()
    # C=1.0 is standard regularization; dual='auto' or max_iter ensures stable convergence
    model = LinearSVC(C=1.0, max_iter=2000, random_state=42)
    model.fit(X_train, y_train)
    print(f"Training completed in {time.time() - start_time:.2f} seconds.")

    # Save model and vectorizer for later evaluation/inference
    with open("pos_model.pkl", "wb") as f:
        pickle.dump((model, vectorizer), f)
    print("Model saved to pos_model.pkl")

    print("\nEvaluating on Test Set...")
    y_pred = model.predict(X_test)
    
    acc = accuracy_score(y_test, y_pred)
    print(f"\nOverall POS Tagging Accuracy: {acc * 100:.2f}%")
    
    print("\nDetailed Classification Report:")
    print(classification_report(y_test, y_pred, zero_division=0))

if __name__ == '__main__':
    main()

