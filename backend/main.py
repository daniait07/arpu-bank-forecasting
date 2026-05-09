from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pickle, numpy as np, pandas as pd
import os, warnings
warnings.filterwarnings('ignore')

app = FastAPI(title="ARPU Forecast API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = os.getenv("DATA_PATH", os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

print("Loading models...")
with open(os.path.join(DATA_PATH, "data_bundle.pkl"), "rb") as f:
    D = pickle.load(f)
with open(os.path.join(DATA_PATH, "models_bundle.pkl"), "rb") as f:
    M = pickle.load(f)

MODELS = {
    "random_forest": M["rf"],
    "xgboost":       M["xgb"],
    "lasso":         M["lasso"],
    "ridge":         M["ridge"],
    "lightgbm":      M["lgb"],
}
FEATURE_COLS = D["FEATURE_COLS"]
df_model     = D["df_model"]
test_df      = D["test_df"]
train_df     = D["train_df"]
val_df       = D["val_df"]

import shap
EXPLAINERS = {}
for name, model in [("random_forest", M["rf"]),
                     ("xgboost", M["xgb"]),
                     ("lightgbm", M["lgb"])]:
    try:
        EXPLAINERS[name] = shap.TreeExplainer(model)
    except:
        pass

print("модель загружена")

class ForecastRequest(BaseModel):
    model:   str = "random_forest"
    horizon: int = 1

SEGMENT_MULTIPLIERS = {
    "mass":    0.15,
    "comfort": 0.40,
    "premium": 1.20,
    "vip":     4.50,
    "all":     1.0,
}

class WhatIfRequest(BaseModel):
    model:                  str   = "random_forest"
    segment:                str   = "all"
    campaign_active:        int   = 0
    campaign_response:      int   = 0
    offer_relevance:        float = 50.0
    avg_balance_30d:        float = 200000.0
    credit_utilization:     float = 0.35
    transactions_amount_7d: float = 50000.0
    num_products:           float = 3.0
    digital_score:          float = 50.0
    churn_score:            float = 0.25
    risk_score:             float = 0.20
    is_weekend:             int   = 0
    is_holiday:             int   = 0
    is_salary_day:          int   = 0
    is_month_end:           int   = 0
    month:                  int   = 6

@app.get("/")
def root():
    return {"status": "ok", "message": "ARPU Forecast API"}

@app.get("/history")
def get_history():
    df = pd.concat([train_df, val_df, test_df]).reset_index(drop=True)
    return {
        "dates":     df["date"].astype(str).tolist(),
        "values":    df["arpu_mean"].round(2).tolist(),
        "train_end": str(train_df["date"].max().date()),
        "val_end":   str(val_df["date"].max().date()),
        "test_end":  str(test_df["date"].max().date()),
    }

@app.get("/segments")
def get_segments():
    return {
        "segments": ["mass", "comfort", "premium", "vip"],
        "arpu_mean": [30.6, 89.6, 331.0, 1276.0],
        "arpu_min":  [15.0, 40.0, 100.0, 300.0],
        "arpu_max":  [45.0, 120.0, 400.0, 1500.0],
    }

@app.get("/revenue_structure")
def get_revenue_structure():
    return {
        "labels": ["Interchange","Кредитный %","Комиссии",
                   "Депозитная маржа","Инвестиции","Страхование","Премиум"],
        "values": [28.7, 24.6, 26.7, 9.6, 4.8, 3.3, 2.4],
        "colors": ["#3b82f6","#f87171","#34d399","#818cf8",
                   "#f59e0b","#06b6d4","#a78bfa"],
    }

@app.get("/model_comparison")
def model_comparison():
    return [
        {"model":"Random Forest","class":"ML (ансамблевые)","MAE":3.36,"RMSE":6.00,"MAPE":1.63,"R2":0.896},
        {"model":"XGBoost",      "class":"ML (ансамблевые)","MAE":3.71,"RMSE":6.23,"MAPE":1.83,"R2":0.887},
        {"model":"Lasso",        "class":"ML (линейные)",   "MAE":3.86,"RMSE":6.67,"MAPE":1.87,"R2":0.871},
        {"model":"Ridge",        "class":"ML (линейные)",   "MAE":3.98,"RMSE":6.92,"MAPE":1.94,"R2":0.861},
        {"model":"ElasticNet",   "class":"ML (линейные)",   "MAE":4.01,"RMSE":7.05,"MAPE":1.96,"R2":0.855},
        {"model":"SARIMAX",      "class":"Статистические",  "MAE":4.26,"RMSE":8.01,"MAPE":2.09,"R2":0.814},
        {"model":"SARIMA",       "class":"Статистические",  "MAE":5.11,"RMSE":9.65,"MAPE":2.52,"R2":0.730},
        {"model":"LightGBM",     "class":"ML (ансамблевые)","MAE":5.28,"RMSE":9.42,"MAPE":2.67,"R2":0.742},
        {"model":"Holt-Winters", "class":"Статистические",  "MAE":18.19,"RMSE":22.53,"MAPE":9.01,"R2":-0.470},
        {"model":"Baseline",     "class":"Baseline",        "MAE":16.59,"RMSE":21.30,"MAPE":8.25,"R2":-0.315},
    ]

@app.post("/forecast")
def forecast(req: ForecastRequest):
    if req.model not in MODELS:
        return {"error": f"Unknown model: {req.model}"}
    n_tv   = len(D["X_train"]) + len(D["X_val"])
    X_te   = D["X_test"]
    target_col = f"target_h{req.horizon}"
    if target_col not in df_model.columns:
        return {"error": f"Horizon {req.horizon} not available"}
    y_true = df_model[target_col].values[n_tv:]
    model  = MODELS[req.model]
    y_pred = model.predict(X_te)
    mae    = float(np.mean(np.abs(y_true - y_pred)))
    rmse   = float(np.sqrt(np.mean((y_true - y_pred)**2)))
    mape   = float(np.mean(np.abs((y_true-y_pred)/(np.abs(y_true)+1e-8)))*100)
    r2     = float(1 - np.sum((y_true-y_pred)**2)/
                   (np.sum((y_true-np.mean(y_true))**2)+1e-8))
    std_err  = float(np.std(y_true - y_pred))
    return {
        "model":    req.model,
        "horizon":  req.horizon,
        "dates":    test_df["date"].astype(str).tolist(),
        "y_true":   [round(float(v),2) for v in y_true],
        "y_pred":   [round(float(v),2) for v in y_pred],
        "ci_lower": [round(float(v),2) for v in y_pred - 1.96*std_err],
        "ci_upper": [round(float(v),2) for v in y_pred + 1.96*std_err],
        "metrics":  {"MAE":round(mae,4),"RMSE":round(rmse,4),
                     "MAPE":round(mape,4),"R2":round(r2,4)},
    }

@app.post("/whatif")
def whatif(req: WhatIfRequest):
    if req.model not in MODELS:
        return {"error": f"Unknown model: {req.model}"}
    x_input  = D["X_test"][-1].copy()
    feat_idx = {f: i for i, f in enumerate(FEATURE_COLS)}
    overrides = {
        "campaign_active":        req.campaign_active,
        "campaign_response":      req.campaign_response,
        "offer_relevance_score":  req.offer_relevance,
        "avg_balance_30d":        req.avg_balance_30d,
        "credit_utilization":     req.credit_utilization,
        "transactions_amount_7d": req.transactions_amount_7d,
        "num_products":           req.num_products,
        "digital_score":          req.digital_score,
        "churn_score":            req.churn_score,
        "risk_score":             req.risk_score,
        "is_weekend":             req.is_weekend,
        "is_holiday":             req.is_holiday,
        "is_salary_day":          req.is_salary_day,
        "is_month_end":           req.is_month_end,
        "month":                  req.month,
    }
    for feat, val in overrides.items():
        if feat in feat_idx:
            x_input[feat_idx[feat]] = val
    mult = SEGMENT_MULTIPLIERS.get(req.segment, 1.0)
    if mult != 1.0:
        for i, feat in enumerate(FEATURE_COLS):
            if "arpu" in feat:
                x_input[i] *= mult
    x_base   = D["X_test"][-1].copy()
    model    = MODELS[req.model]
    arpu_pred = float(model.predict(x_input.reshape(1,-1))[0])
    arpu_base = float(model.predict(x_base.reshape(1,-1))[0])
    shap_result = {"available": False}
    if req.model in EXPLAINERS:
        try:
            sv  = EXPLAINERS[req.model].shap_values(x_input.reshape(1,-1))[0]
            top = np.argsort(np.abs(sv))[-10:][::-1]
            shap_result = {
                "available": True,
                "features":       [FEATURE_COLS[i] for i in top],
                "values":         [round(float(sv[i]),4) for i in top],
                "feature_values": [round(float(x_input[i]),4) for i in top],
            }
        except Exception as e:
            shap_result = {"available": False, "error": str(e)}
    return {
        "model":          req.model,
        "arpu_predicted": round(arpu_pred, 2),
        "arpu_baseline":  round(arpu_base, 2),
        "arpu_delta":     round(arpu_pred - arpu_base, 2),
        "arpu_delta_pct": round((arpu_pred-arpu_base)/(arpu_base+1e-8)*100, 2),
        "context": {
            "test_mean":  round(float(np.mean(D["y_test"])), 2),
            "test_std":   round(float(np.std(D["y_test"])), 2),
            "percentile": round(float(np.mean(D["y_test"] <= arpu_pred))*100, 1),
        },
        "shap": shap_result,
    }

@app.get("/shap_summary")
def shap_summary():
    result = {}
    for mname, key in [("lightgbm","shap_lgb"),
                        ("xgboost","shap_xgb"),
                        ("random_forest","shap_rf")]:
        sv = M.get(key)
        if sv is None:
            continue
        mean_abs = np.abs(sv).mean(axis=0)
        top15    = np.argsort(mean_abs)[-15:][::-1]
        result[mname] = {
            "features": [FEATURE_COLS[i] for i in top15],
            "values":   [round(float(mean_abs[i]),4) for i in top15],
        }
    return result
