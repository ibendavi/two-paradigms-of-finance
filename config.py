"""
Configuration for The Two Paradigms of Finance website.
"""
import os

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
LITERATURE_ROOT = os.path.dirname(PROJECT_ROOT)  # EPS Literature/

RESEARCH_NOTES_DIR = os.path.join(LITERATURE_ROOT, "Research Notes")
BIBLIOGRAPHY_PATH = os.path.join(
    LITERATURE_ROOT, "Bibliographies", "Omnibus_Book_Bibliography.xlsx"
)
TEMPLATES_DIR = os.path.join(PROJECT_ROOT, "templates")
STATIC_DIR = os.path.join(PROJECT_ROOT, "static")
CONTENT_DIR = os.path.join(PROJECT_ROOT, "content")
BUILD_DIR = os.path.join(PROJECT_ROOT, "build")

# ---------------------------------------------------------------------------
# Site metadata
# ---------------------------------------------------------------------------
SITE = {
    "title": "The Two Paradigms of Finance",
    "subtitle": "How Practitioners and Academics Diverged After 1958",
    "description": (
        "A primary-source history of how financial thinking split into two streams: "
        "the practitioner tradition of earnings capitalization (P = EPS × P/E) "
        "and the academic revolution of NPV, CAPM, and DCF."
    ),
    "authors": "Itzhak Ben-David & Alex Chinco",
    "affiliation": "The Ohio State University & Michigan State University",
    "url": "",  # set when deploying
}

# ---------------------------------------------------------------------------
# Paradigm definitions
# ---------------------------------------------------------------------------
PARADIGMS = {
    "practitioner": {
        "label": "Practitioner Paradigm",
        "short": "Practitioner",
        "color": "#e2b714",  # gold
        "bg": "rgba(226, 183, 20, 0.10)",
        "description": (
            "Earnings capitalization: P = EPS × P/E from comps. "
            "Cost of equity = earnings yield. Objective = maximize EPS."
        ),
    },
    "academic": {
        "label": "Academic Paradigm",
        "short": "Academic",
        "color": "#38bdf8",  # sky blue
        "bg": "rgba(56, 189, 248, 0.10)",
        "description": (
            "NPV / DCF: P = Σ CF/(1+r)^t. "
            "Cost of equity from CAPM / factor model. Objective = maximize firm value."
        ),
    },
    "transitional": {
        "label": "Transitional",
        "short": "Transitional",
        "color": "#a78bfa",  # purple
        "bg": "rgba(167, 139, 250, 0.10)",
        "description": "Works that bridge or straddle both paradigms.",
    },
    "pre-split": {
        "label": "Pre-Split Consensus",
        "short": "Pre-Split",
        "color": "#94a3b8",  # slate
        "bg": "rgba(148, 163, 184, 0.10)",
        "description": "Before the 1958 revolution — everyone used the same framework.",
    },
}

# ---------------------------------------------------------------------------
# Era definitions
# ---------------------------------------------------------------------------
ERAS = [
    {
        "id": "consensus",
        "name": "The Consensus Era",
        "years": "1720–1957",
        "description": (
            "For over 200 years, practitioners and scholars alike valued "
            "assets by capitalizing earnings at market-observed yields."
        ),
    },
    {
        "id": "revolution",
        "name": "The Revolution",
        "years": "1958–1963",
        "description": (
            "In just five years, Modigliani-Miller, Markowitz, Sharpe, "
            "and Solomon replaced earnings maximization with value maximization "
            "as the academic standard."
        ),
    },
    {
        "id": "divergence",
        "name": "The Great Divergence",
        "years": "1964–present",
        "description": (
            "Academic textbooks teach NPV/CAPM/DCF. "
            "Practitioners continue using EPS × P/E, earnings yields, and comps."
        ),
    },
]

# ---------------------------------------------------------------------------
# Paradigm-assignment keywords (used by build.py to auto-classify notes)
# ---------------------------------------------------------------------------
PRACTITIONER_KEYWORDS = [
    "earnings yield", "earnings capitalization", "capitalize earnings",
    "capitalization rate", "cap rate", "earning power", "comps",
    "comparables", "P/E", "price-earnings", "earnings-price",
    "EPS maximiz", "maximize EPS", "EPS accret", "practitioner",
    "trading on equity", "Wall Street", "analyst forecast",
    "relative valuation", "multiples",
]

ACADEMIC_KEYWORDS = [
    "NPV", "net present value", "CAPM", "capital asset pricing",
    "efficient market", "Modigliani-Miller", "M&M", "MM",
    "beta", "factor model", "arbitrage pricing", "Black-Scholes",
    "option pricing", "maximize value", "maximize firm value",
    "market value maximiz", "DCF", "discounted cash flow",
    "PVGO", "present value of growth",
]

# Notes that should be excluded from evidence pages
EXCLUDED_NOTES = [
    "search_results_fisher_rate.md",
    "SYNTHESIS_EvolutionOfEquityValuation.md",
    "SYNTHESIS_ValuationConceptEvolution.md",
    "Capitalization_vs_Discounting.md",
]

# Notes shown on the interactive timeline (textbooks + MM papers only).
# All other notes still get evidence pages but don't appear on the timeline.
TIMELINE_NOTES = {
    # --- Pre-1900 books ---
    "Valuation_Hutcheson1720_EarliestEquityValuation",
    "Valuation_Fairman1795_FirstYieldComparison",
    "Valuation_Crump1874_SpeculationTheory",
    "Valuation_Aubrey1896_StockExchangeInvestments",
    # --- Early 20th-century textbooks ---
    "Valuation_Mead1910_CorporationFinance",
    "Valuation_Lyon1917_FinanceCurriculum",
    "Valuation_Dewing1920_FinancialPolicy",
    "Valuation_Smith1924_StocksAsInvestments",
    "Valuation_Gerstenberg1924_CorpFinTextbook",
    "Valuation_Badger1925_EarningsCapitalization",
    "Valuation_Fisher1907_RateOfInterest",
    "Valuation_Fisher1930_TheoryOfInterest",
    "Valuation_BerleMeans1932_ModernCorporation",
    "Valuation_Bonbright1937_PropertyValuation",
    "Valuation_Williams1938_InvestmentValue",
    "Valuation_GrahamDodd1940_SecurityAnalysis",
    "Valuation_GuthmannDougall1940_CorporateFinancialPolicy",
    # --- Transitional era ---
    "Valuation_Dean1951_CapitalBudgeting",
    "Valuation_Markowitz1959_PortfolioSelection",
    "Valuation_Solomon1963_TheoryOfFinancialManagement",
    "CreditRisk_Hickman1958_CorporateBondQuality",
    # --- MM papers (the exception: keep these despite being papers) ---
    "Valuation_ModiglianiMiller1958_CostOfCapital",
    "CapitalStructure_ModiglianiMiller1958_CostOfCapitalCorporationFinance",
    "Valuation_MillerModigliani1961_DividendPolicy",
    "Dividends_MillerModigliani1961_DividendPolicyGrowthValuation",
    "Valuation_MM1963_CorporateIncomeTaxesCostOfCapital",
    # --- Post-split textbooks ---
    "Valuation_Brealey1969_RiskAndReturn",
    "Textbook_VanHorne1971_FinancialManagementPolicy",
    "Valuation_CraggMalkiel1982_ExpectationsSharePrices",
    "Textbook_CopelandWeston1988_FinancialTheoryCorporatePolicy",
    "Textbook_Weston1962_ManagerialFinance",
    "Brealey_Myers_EPS_Treatment_6th7thEd",
    "Valuation_Damodaran2012_InvestmentValuation",
    "Valuation_Gordon1963_OptimalInvestmentFinancingPolicy",
}
