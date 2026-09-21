from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split

# 1. Load Iris dataset
iris = load_iris()
X, y = iris.data, iris.target

# 2. Convert to Binary Classification: Class 0 (Setosa) vs. Others (-1)
# Class 0 -> +1, Classes 1 and 2 -> -1
binary_y = [+1 if label == 0 else -1 for label in y]

# 3. Split into train (80%) and test (20%) sets
X_train, X_test, y_train, y_test = train_test_split(
    X, binary_y, test_size=0.2, random_state=42
)

def write_svm_file(filename, features, labels):
    with open(filename, 'w', encoding='utf-8') as f:
        for label, vector in zip(labels, features):
            # TinySVM format: label index:value index:value ...
            # Feature indices start at 1
            feat_str = " ".join([f"{idx+1}:{val:.4f}" for idx, val in enumerate(vector)])
            f.write(f"{label} {feat_str}\n")

# 4. Write out files for TinySVM
write_svm_file("iris_train.svm", X_train, y_train)
write_svm_file("iris_test.svm", X_test, y_test)

print("Preprocessing complete! Created 'iris_train.svm' and 'iris_test.svm'.")

