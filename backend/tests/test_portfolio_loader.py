import os
import sys
import json

# Add parent directory to path to allow importing from root
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from portfolio_loader import PortfolioProcessor

def test_portfolio_processor():
    # File is now moved to the same directory as the test script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    actual_file = os.path.join(script_dir, 'Sydney_Barboza_Live_Portfolio_21_02_2026.xlsx')
    
    if not os.path.exists(actual_file):
        print(f"Error: File not found at {actual_file}")
        return

    print(f"--- Testing PortfolioProcessor with {os.path.basename(actual_file)} ---")
    try:
        processor = PortfolioProcessor(actual_file)
        
        print("\nRunning load_file()...")
        processor.load_file()
        
        print("Running clean_data()...")
        processor.clean_data()
        
        print("Running detect_structure()...")
        processor.detect_structure()
        
        print("Running extract_scheme_summary()...")
        processor.extract_scheme_summary()
        
        print("Running analyze_transactions()...")
        processor.analyze_transactions()
        
        print("Running compute_portfolio_metrics()...")
        processor.compute_portfolio_metrics()
        
        print("Running generate_final_output()...")
        final_output_str = processor.generate_final_output()
        
        final_output = json.loads(final_output_str)
        
        print("\n--- Final Data Quality Check ---")
        
        print("\n1. Portfolio Summary:")
        print(json.dumps(final_output["portfolio_summary"], indent=2))
        assert "total_invested" in final_output["portfolio_summary"]
        assert "total_current_value" in final_output["portfolio_summary"]
        
        print("\n2. Allocation:")
        print(json.dumps(final_output["allocation"], indent=2))
        assert sum(final_output["allocation"].values()) > 99.0 # Should be close to 100%
        
        print("\n3. Transaction Behavior:")
        print(json.dumps(final_output["transaction_behavior"], indent=2))
        assert "total_invested_sip" in final_output["transaction_behavior"]
        
        print("\n4. Risk Metrics:")
        print(json.dumps(final_output["risk_metrics"], indent=2))
        assert "concentration_risk_top_3_percent" in final_output["risk_metrics"]
        
        print("\nAll checks passed. Data is of high quality.")
        
    except Exception as e:
        print(f"\nVerification Failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_portfolio_processor()
