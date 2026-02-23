import pandas as pd
import os

# Create a mock Excel file for testing
data = {
    'Asset': ['AAPL', 'GOOGL', 'BTC', 'Cash', 'Gold'],
    'Value': [5000, 10000, 2000, '1500', 3000.50],  # Mixed numeric and string-numeric
    'Type': ['Stock', 'Stock', 'Crypto', 'Currency', 'Commodity'],
    'Risk': [0.8, 0.7, 0.9, 0.1, 0.4]
}

df = pd.DataFrame(data)
filepath = 'mock_portfolio.xlsx'
df.to_excel(filepath, index=False)
print(f"Mock Excel file created: {filepath}")
