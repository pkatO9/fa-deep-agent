import json

class SeniorFinancialAdvisorAgent:
    def __init__(self):
        self.age = None
        self.income = None
        self.holdings = []
        self.allocation = None
        self.risk_summary = None
        self.diversification = None
        self.recommendations = None

    def ask_questions(self):
        print("Welcome! I'm your senior financial advisor.")
        self.age = int(input("What is your age? "))
        self.income = float(input("What is your annual income (USD)? "))
        print("Let's input your portfolio. Enter each asset as 'type,name,value' (e.g., stock,AAPL,40000). Type 'done' when finished.")
        while True:
            entry = input("Asset entry: ")
            if entry.strip().lower() == 'done':
                break
            try:
                asset_type, asset_name, asset_value = entry.split(',')
                self.holdings.append({'type': asset_type.strip(), 'name': asset_name.strip(), 'value': float(asset_value)})
            except Exception:
                print("Invalid format. Try again.")
        self._process_inputs()

    def _process_inputs(self):
        self.allocation = self._calculate_allocation()
        self.risk_summary = self._calculate_risk_exposure()
        self.diversification = self._calculate_diversification()
        self.recommendations = self._recommend_actions()

    def _calculate_allocation(self):
        total = sum([h['value'] for h in self.holdings])
        type_summary = {}
        for h in self.holdings:
            type_summary[h['type']] = type_summary.get(h['type'], 0) + h['value']
        return {atype: {
            'value': val,
            'percent': round(100 * val / total, 2)
        } for atype, val in type_summary.items()}

    def _calculate_risk_exposure(self):
        risk_levels = {
            'stock': 'high',
            'mutual_fund': 'medium',
            'bond': 'low',
            'real_estate': 'medium',
        }
        exposure = {}
        for h in self.holdings:
            risk = risk_levels.get(h['type'], 'unknown')
            exposure[risk] = exposure.get(risk, 0) + h['value']
        total = sum([h['value'] for h in self.holdings])
        return {level: {
            'value': val,
            'percent': round(100 * val / total, 2)
        } for level, val in exposure.items()}

    def _calculate_diversification(self):
        assets = set([h['type'] for h in self.holdings])
        gaps = [atype for atype in ['stock', 'bond', 'mutual_fund', 'real_estate'] if atype not in assets]
        concentration = [atype for atype, data in self.allocation.items() if data['percent'] > 50]
        return {
            'gaps': gaps,
            'concentration': concentration,
            'num_types': len(assets)
        }

    def _recommend_actions(self):
        recs = []
        if any(g for g in self.diversification['gaps']):
            recs.append(f"Consider adding {', '.join(self.diversification['gaps'])} assets for better diversification.")
        for c in self.diversification['concentration']:
            recs.append(f"Your portfolio is concentrated in {c}. Consider rebalancing.")

        if (self.age is not None) and (self.age > 50) and (self.allocation.get('stock', {}).get('percent', 0) > 40):
            recs.append("As you approach retirement, consider reducing stock exposure to lower risk.")
        elif (self.age is not None) and (self.age < 40) and (self.allocation.get('stock', {}).get('percent', 0) < 50):
            recs.append("With a long investment horizon, you may tolerate more equities for higher growth.")
        if self.income is not None and self.income > 150000:
            recs.append("Higher income enables diversification into alternative assets.")
        return recs if recs else ["Portfolio appears balanced. Keep monitoring regularly."]

    def allocation_summary(self):
        print("Allocation Summary:")
        print(self.allocation)

    def risk_exposure_summary(self):
        print("Risk Exposure Summary:")
        print(self.risk_summary)

    def diversification_analysis(self):
        print("Diversification Analysis:")
        print(self.diversification)

    def actionable_recommendations(self):
        print("Actionable Recommendations:")
        for rec in self.recommendations:
            print(f"- {rec}")

    def interactive_chat(self):
        print("Type your question about allocation, risk, diversification, or recommendations. Type 'exit' to quit.")
        while True:
            question = input("Question: ")
            if question.strip().lower() == 'exit':
                print("Goodbye!")
                break
            if 'allocation' in question.lower():
                self.allocation_summary()
            elif 'risk' in question.lower():
                self.risk_exposure_summary()
            elif 'diversification' in question.lower():
                self.diversification_analysis()
            elif 'recommend' in question.lower() or 'action' in question.lower():
                self.actionable_recommendations()
            else:
                print("Please clarify your question or specify whether you want allocation, risk, diversification, or recommendations.")
