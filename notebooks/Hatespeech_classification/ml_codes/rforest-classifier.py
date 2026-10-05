#!/usr/bin/env python3
## Random Forest Classifier — fixed version
## - keep_default_na=False so labels like "NA"/"NaN" survive
## - .to_numpy() instead of .values to avoid PyArrow indexing bug
## - separate X_test_* variables for count vs tf-idf models
## - random_state=42 for reproducible splits

import warnings
warnings.filterwarnings("ignore")

import pandas as pd
import numpy as np
from os import system
from scipy.sparse import csr_matrix, save_npz
from sklearn.feature_extraction.text import CountVectorizer, TfidfTransformer
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report
from joblib import dump, load

# ---------------------------------------------------------------- load data
polar_train = pd.read_csv('csv/train.csv', keep_default_na=False)
polar_test  = pd.read_csv('csv/test.csv',  keep_default_na=False)

# Sanity check — abort early if labels still contain NaN
if polar_train['label'].isna().any() or polar_test['label'].isna().any():
    raise SystemExit("ERROR: label column still contains NaN. "
                     "Please inspect csv/train.csv manually.")

print("Train size:", polar_train.shape, "| Test size:", polar_test.shape)
print("Train label distribution:\n", polar_train['label'].value_counts())
print()

system("mkdir -p data_preprocessors")
system("mkdir -p vectorized_data")
system("mkdir -p classifiers")

# ---------------------------------------------------- convert to NumPy once
# ▼▼▼ IMPORTANT: force plain numpy arrays, NOT pandas ArrowExtensionArray ▼▼▼
X_train_text = polar_train['text'].to_numpy()
X_test_text  = polar_test['text'].to_numpy()
y_train      = polar_train['label'].to_numpy()
y_test       = polar_test['label'].to_numpy()
# ▲▲▲ IMPORTANT ▲▲▲

# ------------------------------------------------------------ unigram counts
unigram_vectorizer = CountVectorizer(ngram_range=(1, 1))
unigram_vectorizer.fit(X_train_text)
dump(unigram_vectorizer, 'data_preprocessors/unigram_vectorizer.joblib')

X_train_unigram = unigram_vectorizer.transform(X_train_text)
save_npz('vectorized_data/X_train_unigram.npz', X_train_unigram)

# ------------------------------------------------------------ unigram tf-idf
unigram_tf_idf_transformer = TfidfTransformer()
unigram_tf_idf_transformer.fit(X_train_unigram)
dump(unigram_tf_idf_transformer,
     'data_preprocessors/unigram_tf_idf_transformer.joblib')

X_train_unigram_tf_idf = unigram_tf_idf_transformer.transform(X_train_unigram)
save_npz('vectorized_data/X_train_unigram_tf_idf.npz', X_train_unigram_tf_idf)

# ------------------------------------------------------------- bigram counts
bigram_vectorizer = CountVectorizer(ngram_range=(1, 2))
bigram_vectorizer.fit(X_train_text)
dump(bigram_vectorizer, 'data_preprocessors/bigram_vectorizer.joblib')

X_train_bigram = bigram_vectorizer.transform(X_train_text)
save_npz('vectorized_data/X_train_bigram.npz', X_train_bigram)

# ------------------------------------------------------------ bigram tf-idf
bigram_tf_idf_transformer = TfidfTransformer()
bigram_tf_idf_transformer.fit(X_train_bigram)
dump(bigram_tf_idf_transformer,
     'data_preprocessors/bigram_tf_idf_transformer.joblib')

X_train_bigram_tf_idf = bigram_tf_idf_transformer.transform(X_train_bigram)
save_npz('vectorized_data/X_train_bigram_tf_idf.npz', X_train_bigram_tf_idf)

# ------------------------------------------------------------------- training
def train_and_show_scores_RFOREST(X: csr_matrix, y: np.ndarray,
                                  title: str, model: str) -> None:
    X_train, X_valid, y_train, y_valid = train_test_split(
        X, y, train_size=0.75, stratify=y, random_state=42
    )
    clf = RandomForestClassifier(random_state=42)
    clf.fit(X_train, y_train)
    train_score = clf.score(X_train, y_train)
    valid_score = clf.score(X_valid, y_valid)
    print(f'{title}\n'
          f'Train score: {round(train_score, 2)} ; '
          f'Validation score: {round(valid_score, 2)}\n')
    dump(clf, 'classifiers/' + model)

train_and_show_scores_RFOREST(X_train_unigram,
                              y_train, 'RFOREST, Unigram Counts',
                              'rforest_unigram_count.joblib')
train_and_show_scores_RFOREST(X_train_unigram_tf_idf,
                              y_train, 'RFOREST, Unigram Tf-Idf',
                              'rforest_unigram_tf-idf.joblib')
train_and_show_scores_RFOREST(X_train_bigram,
                              y_train, 'RFOREST, Bigram Counts',
                              'rforest_bigram_count.joblib')
train_and_show_scores_RFOREST(X_train_bigram_tf_idf,
                              y_train, 'RFOREST, Bigram Tf-Idf',
                              'rforest_bigram_tf-idf.joblib')

# ------------------------------------------------------------------ testing
# ---- unigram counts -------------------------------------------------------
X_test_counts = unigram_vectorizer.transform(X_test_text)
rforest_unigram_counts = load('classifiers/rforest_unigram_count.joblib')
score = rforest_unigram_counts.score(X_test_counts, y_test)
print('Random Forest Test Result, Unigram Counts:', score)
y_pred = rforest_unigram_counts.predict(X_test_counts)
print('Error Rate: %.2f' % (y_pred != y_test).mean())
print(classification_report(y_test, y_pred))
print()

# ---- unigram tf-idf -------------------------------------------------------
X_test_tfidf = unigram_tf_idf_transformer.transform(X_test_counts)
rforest_unigram_tfidf = load('classifiers/rforest_unigram_tf-idf.joblib')
score = rforest_unigram_tfidf.score(X_test_tfidf, y_test)
print('Random Forest Test Result, Unigram Tf-Idf:', score)
y_pred = rforest_unigram_tfidf.predict(X_test_tfidf)
print('Error Rate: %.2f' % (y_pred != y_test).mean())
print(classification_report(y_test, y_pred))
print()

# ---- bigram counts --------------------------------------------------------
X_test_bigram_counts = bigram_vectorizer.transform(X_test_text)
rforest_bigram_counts = load('classifiers/rforest_bigram_count.joblib')
score = rforest_bigram_counts.score(X_test_bigram_counts, y_test)
print('Random Forest Test Result, Bigram Count:', score)
y_pred = rforest_bigram_counts.predict(X_test_bigram_counts)
print('Error Rate: %.2f' % (y_pred != y_test).mean())
print(classification_report(y_test, y_pred))
print()

# ---- bigram tf-idf --------------------------------------------------------
X_test_bigram_tfidf = bigram_tf_idf_transformer.transform(X_test_bigram_counts)
rforest_bigram_tfidf = load('classifiers/rforest_bigram_tf-idf.joblib')
score = rforest_bigram_tfidf.score(X_test_bigram_tfidf, y_test)
print('Random Forest Test Result, Bigram Tf-Idf:', score)
y_pred = rforest_bigram_tfidf.predict(X_test_bigram_tfidf)
print('Error Rate: %.2f' % (y_pred != y_test).mean())
print(classification_report(y_test, y_pred))
