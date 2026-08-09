import pandas as pd
import numpy as np

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

import joblib
# Load the sales dataset
df = pd.read_csv("datasets/sales_data.csv")

print("Dataset loaded successfully!")
print("\n========== First 5 Rows ==========")
print(df.head())

print("\n========== Dataset Shape ==========")
print(df.shape)

print("\n========== Column Names ==========")
print(df.columns)

print("\n========== Dataset Information ==========")
df.info()

print("\n========== Missing Values ==========")
print(df.isnull().sum())

print("\n========== Statistical Summary ==========")
print(df.describe())
# Convert Date column to datetime
df['Date'] = pd.to_datetime(df['Date'])

# Extract useful date features
df['Year'] = df['Date'].dt.year
df['Month'] = df['Date'].dt.month
df['Day'] = df['Date'].dt.day
df['DayOfWeek'] = df['Date'].dt.dayofweek

# Remove original Date column
df.drop('Date', axis=1, inplace=True)

print("\nDate converted successfully!")

print(df.columns.tolist())
# Encode categorical columns
label_encoder = LabelEncoder()

categorical_columns = [
    'Store ID',
    'Product ID',
    'Category',
    'Region',
    'Weather Condition',
    'Promotion',
    'Seasonality',
    'Epidemic'
]

for column in categorical_columns:
    df[column] = label_encoder.fit_transform(df[column])

print("\nCategorical columns encoded successfully!")
# Features
X = df.drop('Demand', axis=1)

# Target
y = df['Demand']

print("\nFeatures and target selected successfully!")
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42 
)

print("\nTraining set:", X_train.shape)
print("Testing set:", X_test.shape)

# Train the Random Forest Regressor
model = RandomForestRegressor(
    n_estimators=100,
    random_state=42
)

model.fit(X_train, y_train)

print("\nModel trained successfully!")

# Predict on test data
y_pred = model.predict(X_test)

print("\nPredictions completed!")

# Evaluate the model
mae = mean_absolute_error(y_test, y_pred)
mse = mean_squared_error(y_test, y_pred)
rmse = np.sqrt(mse)
r2 = r2_score(y_test, y_pred)

print("\n========== Model Evaluation ==========")
print(f"Mean Absolute Error (MAE): {mae:.2f}")
print(f"Mean Squared Error (MSE): {mse:.2f}")
print(f"Root Mean Squared Error (RMSE): {rmse:.2f}")
print(f"R² Score: {r2:.2f}")

# Save the trained model
joblib.dump(model, "models/sales_forecasting.pkl")

print("\nModel saved successfully as sales_forecasting.pkl")


import matplotlib.pyplot as plt

# Feature Importance
importance = model.feature_importances_

feature_importance = pd.DataFrame({
    "Feature": X.columns,
    "Importance": importance
})

feature_importance = feature_importance.sort_values(
    by="Importance",
    ascending=False
)

print("\nFeature Importance:")
print(feature_importance)

feature_importance.to_csv(
    "results/feature_importance.csv",
    index=False
)

plt.figure(figsize=(10,6))
plt.barh(feature_importance["Feature"],
         feature_importance["Importance"])
plt.xlabel("Importance")
plt.title("Feature Importance")
plt.gca().invert_yaxis()

plt.savefig("results/feature_importance.png")
plt.close()

print("Feature Importance Saved!")

plt.figure(figsize=(8,6))

plt.scatter(
    y_test,
    y_pred,
    alpha=0.6
)

plt.xlabel("Actual Demand")
plt.ylabel("Predicted Demand")
plt.title("Actual vs Predicted Demand")

plt.savefig("results/prediction_plot.png")
plt.close()

print("Prediction Plot Saved!")

