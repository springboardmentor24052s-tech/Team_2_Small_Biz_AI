import pandas as pd
import joblib
import matplotlib.pyplot as plt

from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

# =============================
# LOAD DATASET
# =============================

df = pd.read_excel("datasets/Customer_Data.xlsx")

print("Customer Dataset Loaded Successfully!\n")

print(df.head())

print("\nDataset Shape:")
print(df.shape)

print("\nMissing Values:")
print(df.isnull().sum())

# =============================
# SELECT FEATURES
# =============================

features = [
    "Purchase_Frequency",
    "Average_Order_Value",
    "Total_Orders",
    "Total_Spent",
    "Days_Since_Last_Purchase"
]

X = df[features]

# =============================
# SCALE DATA
# =============================

scaler = StandardScaler()

X_scaled = scaler.fit_transform(X)

print("\nData Scaling Completed!")

# =============================
# ELBOW METHOD
# =============================

wcss = []

for i in range(1,11):

    kmeans = KMeans(
        n_clusters=i,
        random_state=42,
        n_init=10
    )

    kmeans.fit(X_scaled)

    wcss.append(kmeans.inertia_)

plt.figure(figsize=(8,5))
plt.plot(range(1,11), wcss, marker="o")
plt.title("Elbow Method")
plt.xlabel("Number of Clusters")
plt.ylabel("WCSS")
plt.grid(True)
plt.savefig("results/elbow_plot.png")
plt.close()
print("Elbow plot saved successfully!")

# =============================
# TRAIN MODEL
# =============================

kmeans = KMeans(
    n_clusters=4,
    random_state=42,
    n_init=10
)

clusters = kmeans.fit_predict(X_scaled)

df["Cluster"] = clusters

print("\nCustomer Segmentation Completed!")

# =============================
# EVALUATE
# =============================

score = silhouette_score(X_scaled, clusters)

print(f"\nSilhouette Score : {score:.3f}")

# =============================
# SAVE MODEL
# =============================

joblib.dump(kmeans, "models/customer_segmentation.pkl")
joblib.dump(scaler, "models/customer_scaler.pkl")

print("\nModel Saved Successfully!")

# =============================
# SAVE OUTPUT
# =============================

df.to_excel(
    "results/customer_segments.xlsx",
    index=False
)

print("\nClustered Customers Saved!")

# =============================
# CLUSTER COUNT
# =============================

print("\nCustomers in each Cluster:\n")

print(df["Cluster"].value_counts().sort_index())

print("\nCluster Summary\n")

summary = df.groupby("Cluster")[[
    "Purchase_Frequency",
    "Average_Order_Value",
    "Total_Orders",
    "Total_Spent",
    "Days_Since_Last_Purchase"
]].mean()

import pandas as pd

pd.set_option("display.max_columns", None)
pd.set_option("display.width", None)

print(summary)

summary.to_excel(
    "results/cluster_summary.xlsx"
)

print("\nCluster Summary Saved!")

import seaborn as sns

plt.figure(figsize=(8,6))

sns.scatterplot(
    data=df,
    x="Average_Order_Value",
    y="Total_Spent",
    hue="Cluster",
    palette="Set2"
)

plt.title("Customer Segments")

plt.savefig("results/customer_clusters.png")
plt.close()

print("Customer Cluster Plot Saved!")
