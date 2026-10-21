# Assignment-3

Based on the practical tutorial from Class 12 (16 Aug 2026, Sunday), try to build the best Named Entity Recognition (NER) model using an SVM and the [myNER](https://github.com/ye-kyaw-thu/myNER) dataset. Please read the previous work on the myNER paper: 

**Abstract:** Named Entity Recognition (NER) involves identifying and categorizing named entities within textual data. Despite its significance, NER research has often overlooked low-resource languages like Myanmar (Burmese), primarily due to the lack of publicly available annotated datasets. To address this, we introduce myNER, a novel word-level NER corpus featuring a 7-tag annotation scheme, enriched with Part-of-Speech (POS) tagging to provide additional syntactic information. Alongside the corpus, we conduct a comprehensive evaluation of NER models, including Conditional Random Fields (CRF), Bidirectional LSTM (BiLSTM)-CRF, and their combinations with fastText embeddings in different settings. Our experiments reveal the effectiveness of contextualized word embeddings and the impact of joint training with POS tagging, demonstrating significant performance improvements across models. The traditional CRF joint-task model with fastText embeddings as a feature achieved the best result, with a 0.9818 accuracy and 0.9811 weighted F1 score with 0.7429 macro F1 score. BiLSTM-CRF with fine-tuned fastText embeddings gets the best result of 0.9791 accuracy and 0.9776 weighted F1 score with 0.7395 macro F1 score.

Kaung Lwin Thant, Kwankamol Nongpong, Ye Kyaw Thu, Thura Aung, Khaing Hsu Wai, Thazin Myint Oo, "myNER: Contextualized Burmese Named Entity Recognition with Bidirectional LSTM and fastText Embeddings via Joint Training with POS Tagging", the International Conference on Cybernetics and Innovations (ICCI 2025), April 2-4, Pattaya Chonburi, Thailand, pp.1-6. [Arxiv Link](https://arxiv.org/pdf/2504.04038)

## For Your Reference

In Class 12, I taught how to build SVM models for Part-of-Speech (POS) tagging for the Myanmar language. Please refer to the following two Jupyter notebooks for details:  

1. [POS tagging model building tutorial with LIBLINEAR](https://github.com/ye-kyaw-thu/AIE-F-B2/blob/main/notebooks/SVM/SVM_tutorial1.ipynb)
2. [Linear Support Vector Classifier (LinearSVC) for POS tagging with Sklearn Python library](https://github.com/ye-kyaw-thu/AIE-F-B2/blob/main/notebooks/SVM/SVM_tutorial3.ipynb)

## Submission and Deadline

Create a zip file containing your completed Jupyter notebook, source code, and running logs. Push the zip file to the following GitHub directory: [https://github.com/ye-kyaw-thu/AIE-F-B2/tree/main/assignment/assignment-3](https://github.com/ye-kyaw-thu/AIE-F-B2/tree/main/assignment/assignment-3) or send it to my Gmail account. 

The deadline is **28 Aug 2026**.
