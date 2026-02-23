import pandas as pd
import logging
import os
import re
import json
import numpy as np

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

class PortfolioProcessor:
    def __init__(self, filepath: str):
        self.filepath = filepath
        self.raw_dfs = {}
        self.cleaned_dfs = {}
        self.classified_sheets = {}
        self.extracted_schemes = []
        self.raw_transactions_by_scheme = {}
        
        self.portfolio_summary = {}
        self.allocation = {}
        self.transaction_behavior = {}
        self.risk_metrics = {}
        self.validation_errors = []

    def _standardize_name(self, name: str) -> str:
        if not isinstance(name, str) or pd.isna(name): return ""
        return re.sub(r'[\s_]+', '_', re.sub(r'[^a-z0-9\s_]', '', str(name).lower())).strip('_')

    def _clean_cell(self, v):
        if v is None or pd.isna(v): return np.nan
        if isinstance(v, str):
            v_str = v.strip().replace(',', '').replace('₹', '').replace('$', '')
            if v_str == '-' or v_str == '': return 0.0
            
            # Handle anomalous percentage formats
            if '%' in v_str:
                try: 
                    return float(v_str.replace('%', '')) / 100.0
                except: 
                    pass
            
            try: 
                return float(v_str)
            except ValueError:
                return v
        return v

    def _is_date(self, v):
        if isinstance(v, str) and len(v) >= 8:
            if re.match(r'\d{2}[-/]\d{2}[-/]\d{2,4}', v): return True
            if re.match(r'\d{2}[-/]\d{2}[-/]\d{2,4}\s\d{2}:\d{2}', v): return True
        return isinstance(v, pd.Timestamp)

    def _infer_category(self, scheme_name: str) -> str:
        n = scheme_name.lower()
        if "arbitrage" in n:
            return "Arbitrage"
        if any(k in n for k in ["liquid", "money market", "overnight"]):
            return "Liquid"
        if any(k in n for k in ["debt", "gilt", "short duration", "ultra short"]):
            return "Debt"
        if any(k in n for k in ["hybrid", "balanced", "advantage"]):
            return "Hybrid"
        if any(k in n for k in ["equity", "midcap", "smallcap", "multicap", "flexicap", "index", "nifty", "momentum", "technology", "innovation", "opportunities"]):
            return "Equity"
        return "Other"

    def load_file(self):
        try:
            if not os.path.exists(self.filepath):
                raise FileNotFoundError(f"File not found: {self.filepath}")
            xl = pd.ExcelFile(self.filepath)
            for sheet_name in xl.sheet_names:
                self.raw_dfs[sheet_name] = pd.read_excel(xl, sheet_name=sheet_name, header=None)
            logger.info("File loaded successfully.")
        except Exception as e:
            logger.error(f"Error loading file: {e}")
            raise

    def clean_data(self):
        try:
            for sheet_name, df in self.raw_dfs.items():
                self.cleaned_dfs[sheet_name] = df.map(self._clean_cell)
            logger.info("Data cleaned successfully.")
        except Exception as e:
            logger.error(f"Error cleaning data: {e}")
            raise

    def detect_structure(self):
        try:
            self.classified_sheets = {"summary_sheet": None, "transaction_sheet": None, "other_sheets": []}
            for sheet_name, df in self.cleaned_dfs.items():
                first_rows_str = " ".join([str(v) for v in df.head(50).values.flatten()]).lower()
                
                # Broad heuristics to distinguish between pure summary vs transaction-level data
                if "transaction" in first_rows_str or ("folio" in first_rows_str and "date" in first_rows_str and "amount" in first_rows_str):
                    self.classified_sheets["transaction_sheet"] = sheet_name
                elif "scheme" in first_rows_str and "nav" in first_rows_str and "folio" not in first_rows_str:
                    self.classified_sheets["summary_sheet"] = sheet_name
                else:
                    self.classified_sheets["other_sheets"].append(sheet_name)
                    
            if not self.classified_sheets["transaction_sheet"] and self.cleaned_dfs:
                # Fallback: assume the first sheet contains the core data if not explicitly identified
                self.classified_sheets["transaction_sheet"] = list(self.cleaned_dfs.keys())[0]

            logger.info("Structure detected.")
        except Exception as e:
            logger.error(f"Error detecting structure: {e}")
            raise

    def extract_scheme_summary(self):
        try:
            sheet_name = self.classified_sheets.get("transaction_sheet") or self.classified_sheets.get("summary_sheet")
            if not sheet_name:
                raise ValueError("No valid sheet found for extraction.")
            
            df = self.cleaned_dfs[sheet_name]
            
            # --- Block Boundary Parsing ---
            blocks = []
            current_block = {"name": None, "rows": []}
            
            for i, row in df.iterrows():
                raw_vals = row.values.tolist()
                row_str = " ".join([str(v).lower() for v in raw_vals if not pd.isna(v)])
                
                # Detect start of a new scheme block
                if ("fund" in row_str or "arbitrage" in row_str or "innovation" in row_str) and "folio" in row_str:
                    # If we were building a block, save it
                    if current_block["name"] is not None:
                        blocks.append(current_block)
                    
                    # Start a new block
                    name = None
                    for v in raw_vals:
                        if isinstance(v, str) and ("fund" in v.lower() or "arbitrage" in v.lower() or "innovation" in v.lower()):
                            name = v.split('\n')[0].split('Folio:')[0].strip()
                            break
                            
                    current_block = {"name": name, "rows": []}
                
                elif current_block["name"] is not None:
                    # Ignore portfolio-level Grand Totals that signal the end of all blocks entirely
                    if "grand total" in row_str or "portfolio sum" in row_str:
                        break
                    current_block["rows"].append(raw_vals)
            
            # Append the final block being built
            if current_block["name"] is not None:
                blocks.append(current_block)
                
            # --- Parse Individuals Blocks ---
            schemes = []
            
            for block in blocks:
                scheme_name = block["name"]
                
                if scheme_name not in self.raw_transactions_by_scheme:
                    self.raw_transactions_by_scheme[scheme_name] = []
                    
                s_data = {
                    "scheme_name": scheme_name,
                    "category": self._infer_category(scheme_name),
                    "invested_amount": 0.0,
                    "current_value": 0.0,
                    "units": 0.0,
                    "xirr": None
                }
                
                # 1. Identify valid summary candidates
                # Candidate A: definitive "Total" row at the end
                total_row = None
                for row_vals in reversed(block["rows"]):
                    row_str = " ".join([str(v).lower() for v in row_vals if not pd.isna(v)])
                    if ("total" in row_str and "abs. rtn" in row_str) or (row_str.startswith("total") and len(row_vals) > 10):
                         total_row = row_vals
                         break
                
                # Candidate B: The very first row of the block (often contains summary for top-summarized files)
                first_row = block["rows"][0]
                
                # Heuristic: Pick the one that has the most numeric data or looks like a summary
                summary_row = total_row if total_row else first_row
                
                if summary_row:
                    # Look for transaction header row in the block to inform summary mapping
                    summary_header_map = {"amount": 5, "current": 14, "units": 10} # Default fallbacks
                    for row_vals in block["rows"][:10]: # Check first 10 rows for a header
                        row_str = " ".join([str(v).lower() for v in row_vals if not pd.isna(v)])
                        if "date" in row_str and ("amount" in row_str or "units" in row_str):
                            for idx, v in enumerate(row_vals):
                                vs = str(v).lower() if not pd.isna(v) else ""
                                if vs == "amount": summary_header_map["amount"] = idx
                                elif "cur. value" in vs or "current" in vs: summary_header_map["current"] = idx
                                elif "units" in vs and "cumm" not in vs: summary_header_map["units"] = idx
                            break
                    
                    def pick_best_num(idx_hint, range_search, data_row):
                        # Try the hint first
                        if idx_hint < len(data_row) and isinstance(data_row[idx_hint], (int, float)) and abs(data_row[idx_hint]) > 100:
                             return float(data_row[idx_hint])
                        # Otherwise search range
                        pool = [(idx, n) for idx, n in enumerate(data_row) if isinstance(n, (int, float)) and abs(n) > 100]
                        filtered = [n for idx, n in pool if idx in range_search]
                        return float(max(filtered)) if filtered else 0.0

                    # Apply mapping with fallback to known index spreads
                    # For summary rows, Amount is often shifted +1 from transaction Amount if Sensex is present
                    possible_inv = [summary_header_map["amount"], summary_header_map["amount"] + 1, 5, 6, 7]
                    s_data["invested_amount"] = pick_best_num(summary_header_map["amount"], possible_inv, summary_row)
                    
                    possible_val = [summary_header_map["current"], 13, 14, 15, 16, 17, 18]
                    s_data["current_value"] = pick_best_num(summary_header_map["current"], possible_val, summary_row)
                    
                    possible_units = [summary_header_map["units"], 9, 10, 11]
                    s_data["units"] = pick_best_num(summary_header_map["units"], possible_units, summary_row)

                    # Extract XIRR if present
                    rets = [v for v in summary_row if isinstance(v, (float, int)) and 0 < abs(v) < 1]
                    if rets: s_data["xirr"] = round(float(rets[-1]), 4)
                         
                if s_data["invested_amount"] > 100 or s_data["current_value"] > 100:
                    schemes.append(s_data)
                    
                # 2. Extract Transactions from the remaining rows
                # Step A: Find the header row in this block to map columns
                header_map = {"date": None, "type": None, "amount": None, "units": None, "nav": None}
                for i, row_vals in enumerate(block["rows"]):
                    row_str = " ".join([str(v).lower() for v in row_vals if not pd.isna(v)])
                    # Look for a row that has date, amount/units, and some description field
                    if "date" in row_str and ("amount" in row_str or "units" in row_str or "purchase" in row_str or "redeem" in row_str):
                        # Detect indices based on keywords in row_vals
                        for idx, v in enumerate(row_vals):
                            vs = str(v).lower() if not pd.isna(v) else ""
                            if "date" in vs: header_map["date"] = idx
                            elif any(k in vs for k in ["transaction", "description", "particular", "nature"]): header_map["type"] = idx
                            elif vs == "amount": header_map["amount"] = idx # Priority match for exact "Amount"
                            elif header_map["amount"] is None and any(k in vs for k in ["purchase", "redeem", "payout"]): header_map["amount"] = idx
                            elif "units" in vs and "cumm" not in vs: header_map["units"] = idx
                            elif "nav" in vs: header_map["nav"] = idx
                        break
                
                # Step B: Parse rows using header_map or fallback
                for row_vals in block["rows"]:
                     if row_vals == summary_row: continue
                     
                     row_str = " ".join([str(v).lower() for v in row_vals if not pd.isna(v)])
                     # Expanded keywords for transaction identification
                     tx_keywords = ["purchase", "sip", "redemption", "sell", "buy", "switch", "swp", "swm"]
                     
                     # AVOID DOUBLE COUNTING: Skip rows that look like summaries or balances
                     skip_keywords = ["dividend", "remaining", "balance", "opening", "summary", "total", "sub-total"]
                     if any(k in row_str for k in skip_keywords): continue

                     if any(k in row_str for k in tx_keywords):
                        date_val = None
                        if header_map["date"] is not None and header_map["date"] < len(row_vals):
                             date_val = row_vals[header_map["date"]] if self._is_date(row_vals[header_map["date"]]) else None
                        else:
                             date_val = next((v for v in row_vals if self._is_date(v)), None)

                        tx_desc = ""
                        if header_map["type"] is not None and header_map["type"] < len(row_vals):
                             tx_desc = str(row_vals[header_map["type"]]).lower()
                        else:
                             tx_desc = row_str

                        # More granular type detection
                        tx_type = "UNKNOWN"
                        if any(k in tx_desc for k in ["redemption", "sell", "withdrawal", "swp", "swm", "out"]): tx_type = "Redemption"
                        elif "sip" in tx_desc: tx_type = "SIP"
                        elif any(k in tx_desc for k in ["purchase", "buy", "investment", "switch", "in"]): tx_type = "Purchase"
                        
                        amount = 0.0
                        if header_map["amount"] is not None and header_map["amount"] < len(row_vals):
                             v = row_vals[header_map["amount"]]
                             amount = float(v) if isinstance(v, (int, float)) and not pd.isna(v) else 0.0
                        else:
                             # Fallback logic: filter out things that are definitely not amounts
                             nums = [v for v in row_vals if isinstance(v, (int, float)) and v != 0 and not pd.isna(v)]
                             # Skip indices that are usually ID or units if they are whole numbers
                             relevant_nums = [n for n in nums if n > 10]
                             amount = relevant_nums[0] if len(relevant_nums) > 0 else 0.0
                        
                        units = 0.0
                        if header_map["units"] is not None and header_map["units"] < len(row_vals):
                             v = row_vals[header_map["units"]]
                             units = float(v) if isinstance(v, (int, float)) and not pd.isna(v) else 0.0
                        
                        amount = abs(amount)
                        
                        if date_val and amount > 0:
                            self.raw_transactions_by_scheme[scheme_name].append({
                                "date": str(date_val).strip(),
                                "type": tx_type,
                                "amount": amount,
                                "units": abs(units)
                            })

            self.extracted_schemes = schemes
            self.portfolio_summary["total_invested"] = sum(s["invested_amount"] for s in schemes)
            logger.info(f"Scheme summary extracted successfully via Block Boundary Parsing: {len(schemes)} distinct schemes found.")
        except Exception as e:
            logger.error(f"Error extracting scheme summary: {e}")
            raise

    def analyze_transactions(self):
        try:
            # Use original references to update types in place
            all_txs_refs = []
            for s_name, tx_list in self.raw_transactions_by_scheme.items():
                for tx in tx_list:
                    all_txs_refs.append(tx)
                    
            by_date = {}
            for t in all_txs_refs:
                by_date.setdefault(t["date"], []).append(t)
                
            # Pattern Discovery for Switch/STP
            for date, daily_txs in by_date.items():
                purchases = [t for t in daily_txs if t["type"] in ["Purchase", "SIP", "UNKNOWN"]]
                redemptions = [t for t in daily_txs if t["type"] == "Redemption"]
                for red in redemptions:
                    for pur in purchases:
                        # STP/Switch detection: Buy/Sell of similar amount on same day
                        if abs(red["amount"] - pur["amount"]) < 1.0:
                            red["type"] = "Switch Out"
                            pur["type"] = "STP" 
                            break
            
            total_sip = 0.0
            total_lumpsum = 0.0
            total_stp = 0.0
            total_others = 0.0
            total_redeemed = 0.0

            for s_name, tx_list in self.raw_transactions_by_scheme.items():
                buys = [t for t in tx_list if t["type"] in ["Purchase", "SIP", "STP", "UNKNOWN"]]
                if not buys: continue
                
                amount_counts = {}
                for b in buys:
                    if b["type"] in ["Purchase", "SIP", "UNKNOWN"]:
                        amount_counts[b["amount"]] = amount_counts.get(b["amount"], 0) + 1
                
                sip_amounts = {amt for amt, count in amount_counts.items() if count >= 3}
                
                for t in tx_list:
                    amt = t["amount"]
                    if t["type"] in ["Purchase", "UNKNOWN"]:
                        if amt in sip_amounts:
                            t["type"] = "SIP"
                            total_sip += amt
                        else:
                            t["type"] = "Lumpsum"
                            total_lumpsum += amt
                    elif t["type"] == "SIP":
                        total_sip += amt
                    elif t["type"] == "STP":
                        total_stp += amt
                    elif t["type"] == "Redemption":
                        total_redeemed += amt
                    elif t["type"] == "Switch Out":
                        # We don't count Switch Out as investment or redemption from a core 'capital invested' perspective
                        # as it's a movement between funds, but the 'Total Invested' usually reflects net capital infused.
                        pass
            
            # --- Reconciliation Logic (Net Investment) ---
            # Total Invested is usually (Purchases + SIP + STP) - Redemptions
            total_detected_invested = total_sip + total_lumpsum + total_stp - total_redeemed
            total_invested_summary = self.portfolio_summary.get("total_invested", 0)
            
            reconciliation_diff = round(total_invested_summary - total_detected_invested, 2)
            
            # Check for Reconciliation Failure
            if abs(reconciliation_diff) > 1.0:
                 if reconciliation_diff > 0:
                      # If we have less transactions than summary, the difference is 'Others' (missing transactions)
                      total_others = reconciliation_diff
                      status = "Reconciliation Adjusted (Missing Txs)"
                 else:
                      # If we have MORE transactions than summary, something is wrong (over-counting or missing redemptions)
                      total_others = 0.0
                      status = "RECONCILIATION_FAILURE: Transaction sum exceeds Summary"
                      self.validation_errors.append(f"RECONCILIATION_FAILURE: Transactions sum to {total_detected_invested} but Summary says {total_invested_summary}")
            else:
                 total_others = 0.0
                 status = "Fully Reconciled"

            frequency = "None"
            if total_sip > 0: frequency = "Monthly (Estimated)"
            
            self.transaction_behavior = {
                "total_invested_sip": round(total_sip, 2),
                "total_invested_lumpsum": round(total_lumpsum, 2),
                "total_invested_stp": round(total_stp, 2),
                "total_invested_others": round(total_others, 2),
                "total_reconciled_investment": round(total_sip + total_lumpsum + total_stp + total_others - total_redeemed, 2),
                "total_redeemed": round(total_redeemed, 2),
                "investment_frequency": frequency,
                "reconciliation_status": status
            }
            logger.info("Transactions analyzed and reconciled.")
        except Exception as e:
            logger.error(f"Error analyzing transactions: {e}")
            raise

    def compute_portfolio_metrics(self):
        try:
            # --- Scheme Consolidation ---
            # Group by scheme_name, sum amounts, and calculate weighted XIRR
            consolidated = {}
            for s in self.extracted_schemes:
                name = s["scheme_name"]
                if name not in consolidated:
                    consolidated[name] = {
                        "scheme_name": name,
                        "category": s["category"],
                        "invested_amount": 0.0,
                        "current_value": 0.0,
                        "units": 0.0,
                        "weighted_xirr_sum": 0.0,
                        "xirr_weight_total": 0.0,
                        "duplicate_count": 0
                    }
                else:
                    consolidated[name]["duplicate_count"] += 1
                
                c = consolidated[name]
                c["invested_amount"] += s["invested_amount"]
                c["current_value"] += s["current_value"]
                c["units"] += s["units"]
                
                if s["xirr"] is not None:
                    # Weight XIRR by current_value for an accurate aggregated performance metric
                    c["weighted_xirr_sum"] += s["xirr"] * s["current_value"]
                    c["xirr_weight_total"] += s["current_value"]

            final_consolidated = []
            for name, c in consolidated.items():
                if c["duplicate_count"] > 0:
                     self.validation_errors.append(f"DUPLICATE CONSOLIDATION: Scheme '{name}' appeared {c['duplicate_count'] + 1} times and was merged.")
                
                res = {
                    "scheme_name": name,
                    "category": c["category"],
                    "invested_amount": round(c["invested_amount"], 2),
                    "current_value": round(c["current_value"], 2),
                    "units": round(c["units"], 4),
                    "xirr": round(c["weighted_xirr_sum"] / c["xirr_weight_total"], 4) if c["xirr_weight_total"] > 0 else None
                }
                final_consolidated.append(res)
            
            self.extracted_schemes = final_consolidated

            # Reconstruct Portfolio Summary strictly from Scheme items to avoid double-counting "grand" totals
            total_inv = sum(s["invested_amount"] for s in self.extracted_schemes)
            total_val = sum(s["current_value"] for s in self.extracted_schemes)
            overall_ret = ((total_val / total_inv) - 1) if total_inv > 0 else 0
            
            self.portfolio_summary = {
                "total_invested": round(total_inv, 2),
                "total_current_value": round(total_val, 2),
                "overall_return_percent": round(overall_ret * 100, 2)
            }
            
            working_val = total_val if total_val > 0 else 1
            
            allocation_dict = {}
            for s in self.extracted_schemes:
                s["gain_loss"] = round(s["current_value"] - s["invested_amount"], 2)
                s["weight_percent"] = round((s["current_value"] / working_val) * 100, 2)
                
                # Validation Logic Implementation
                scheme_return = s["gain_loss"] / s["invested_amount"] if s["invested_amount"] > 0 else 0
                flags = []
                if scheme_return > 1.0: # i.e. 100% gain
                     flags.append("ANOMALY: High Return Detected (>100%)")
                     self.validation_errors.append(f"Scheme '{s['scheme_name']}' flagged with > 100% return ({round(scheme_return*100, 2)}%)")
                if s["xirr"] is None:
                     flags.append("WARNING: XIRR is Null")
                     self.validation_errors.append(f"Scheme '{s['scheme_name']}' has missing XIRR.")
                     
                s["validation_flag"] = " | ".join(flags) if flags else "OK"

                cat = s["category"]
                allocation_dict[cat] = allocation_dict.get(cat, 0) + s["current_value"]
            
            self.allocation = {
                k: round((v / working_val) * 100, 2) for k, v in allocation_dict.items()
            }
            
            # Sub-validation: Allocation sum ≈ 100%
            if not (99.9 <= sum(self.allocation.values()) <= 100.1) and total_val > 0:
                 self.validation_errors.append(f"ALLOCATION WARNING: Total allocation sum is {sum(self.allocation.values())}% (expected ~100%).")
            
            sorted_schemes = sorted(self.extracted_schemes, key=lambda x: x["current_value"], reverse=True)
            top_3_val = sum(s["current_value"] for s in sorted_schemes[:3])
            concentration_risk = round((top_3_val / working_val) * 100, 2)
            
            # --- Diversification Score (HHI) ---
            scheme_weights = [s["current_value"] / working_val for s in self.extracted_schemes]
            scheme_hhi = sum(w**2 for w in scheme_weights)
            
            category_weights = [v / working_val for v in allocation_dict.values()]
            category_hhi = sum(w**2 for w in category_weights)
            
            div_score = round((1 - (scheme_hhi + category_hhi)/2) * 100, 1)
            
            self.risk_metrics = {
                "concentration_risk_top_3_percent": concentration_risk,
                "diversification_score_100": round(div_score, 1)
            }
            
            # --- Strict Portfolio Aggregation Validation ---
            sum_scheme_inv = sum(s["invested_amount"] for s in self.extracted_schemes)
            sum_scheme_curr = sum(s["current_value"] for s in self.extracted_schemes)
            
            if abs(sum_scheme_inv - total_inv) > 1.0:
                 self.validation_errors.append(f"SUM MISMATCH: Sum of scheme invested ({sum_scheme_inv}) != Portfolio invested ({total_inv})")
            if abs(sum_scheme_curr - total_val) > 1.0:
                 self.validation_errors.append(f"SUM MISMATCH: Sum of scheme current ({sum_scheme_curr}) != Portfolio current ({total_val})")
            
            # --- Transaction Tolerance Validation ---
            total_others = self.transaction_behavior.get("total_invested_others", 0)
            if total_inv > 0 and abs(total_others) / total_inv > 0.05:
                self.validation_errors.append(f"TRANSACTION TOLERANCE: Unclassified/reconciled transactions ('Others': {total_others}) exceed 5% of total invested.")
                 
            logger.info("Portfolio metrics computed, validations executed.")
            
        except Exception as e:
            logger.error(f"Error computing portfolio metrics: {e}")
            raise

    def generate_final_output(self) -> str:
        try:
            final_output = {
                "portfolio_summary": self.portfolio_summary,
                "allocation": self.allocation,
                "transaction_behavior": self.transaction_behavior,
                "risk_metrics": self.risk_metrics,
                "validation_errors": self.validation_errors,
                "schemes_extracted": self.extracted_schemes
            }
            return json.dumps(final_output, indent=2)
        except Exception as e:
            logger.error(f"Error generating final output: {e}")
            raise
