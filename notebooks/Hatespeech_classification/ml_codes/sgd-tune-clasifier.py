#!/usr/bin/env python3
## SGD Classifier with Hyperparameter Tuning — fixed version
## - keep_default_na=False so labels like "NA"/"NaN" survive
## - .to_numpy() instead of .values to avoid PyArrow indexing bug
## - random_state=42 for reproducible splits and searches
## - consistent use of X_test_tfidf for the tuned bigram-tf-idf model

import warnings
warnings.filterwarnings("ignore")

import pandas as pd
import numpy as np
from os import system
from scipy.sparse import csr_matrix, save_npz
from sklearn.feature_extraction.text import CountVectorizer, TfidfTransformer
from sklearn.linear_model import SGDClassifier
from sklearn.model_selection import train_test_split, RandomizedSearchCV
from sklearn.metrics import classification_report
from scipy.stats import uniform
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

# -------------------------------------------------------- baseline SGD check
def train_and_show_scores(X: csr_matrix, y: np.ndarray, title: str) -> None:
    X_tr, X_va, y_tr, y_va = train_test_split(
        X, y, train_size=0.75, stratify=y, random_state=42
    )
    clf = SGDClassifier(random_state=42)
    clf.fit(X_tr, y_tr)
    train_score = clf.score(X_tr, y_tr)
    valid_score = clf.score(X_va, y_va)
    print(f'{title}\n'
          f'Train score: {round(train_score, 2)} ; '
          f'Validation score: {round(valid_score, 2)}\n')

train_and_show_scores(X_train_unigram,        y_train, 'Unigram Counts')
train_and_show_scores(X_train_unigram_tf_idf, y_train, 'Unigram Tf-Idf')
train_and_show_scores(X_train_bigram,         y_train, 'Bigram Counts')
train_and_show_scores(X_train_bigram_tf_idf,  y_train, 'Bigram Tf-Idf')

# ---------------------------------------------------- Hyperparameter Tuning
X_train = X_train_bigram_tf_idf

# ---- Phase 1: loss / learning_rate / eta0 ---------------------------------
clf = SGDClassifier(random_state=42)

distributions = dict(
    loss=['hinge', 'log', 'modified_huber', 'squared_hinge', 'perceptron'],
    learning_rate=['optimal', 'invscaling', 'adaptive'],
    eta0=uniform(loc=1e-7, scale=1e-2),
)

random_search_cv = RandomizedSearchCV(
    estimator=clf,
    param_distributions=distributions,
    cv=5,
    n_iter=50,
    random_state=42,
    n_jobs=-1,
)
random_search_cv.fit(X_train, y_train)
print(f'Best params (phase 1): {random_search_cv.best_params_}')
print(f'Best score  (phase 1): {random_search_cv.best_score_}\n')

# ---- Phase 2: penalty / alpha ---------------------------------------------
clf = SGDClassifier(random_state=42)

distributions = dict(
    penalty=['l1', 'l2', 'elasticnet'],
    alpha=uniform(loc=1e-6, scale=1e-4),
)

random_search_cv = RandomizedSearchCV(
    estimator=clf,
    param_distributions=distributions,
    cv=5,
    n_iter=50,
    random_state=42,
    n_jobs=-1,
)
random_search_cv.fit(X_train, y_train)
print(f'Best params (phase 2): {random_search_cv.best_params_}')
print(f'Best score  (phase 2): {random_search_cv.best_score_}\n')

# -------------------------------------------------- Saving the best classifier
sgd_classifier = random_search_cv.best_estimator_
dump(sgd_classifier, 'classifiers/sgd_classifier.joblib')

# ---------------------------------------------------------------- Evaluation
X_test_tfidf = bigram_vectorizer.transform(X_test_text)
X_test_tfidf = bigram_tf_idf_transformer.transform(X_test_tfidf)

score = sgd_classifier.score(X_test_tfidf, y_test)
print('Tuned SGD Test Result, Bigram Tf-Idf:', score)

y_predict = sgd_classifier.predict(X_test_tfidf)

err_rate = (y_predict != y_test).mean()
print('Error Rate: %.2f' % err_rate)
print('----------')
print(classification_report(y_test, y_predict))
