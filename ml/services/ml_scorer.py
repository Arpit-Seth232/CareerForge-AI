"""
ML-based ATS Scoring Engine for CareerForge.

Uses XGBoost to learn optimal scoring weights from real hiring outcomes.
Works in tandem with the deterministic ats_scorer.py:

  - Phase 1 (cold start): deterministic rules only
  - Phase 2 (collecting):  log features + outcomes as training data
  - Phase 3 (trained):     ML model predicts, rules act as fallback
  - Phase 4 (continuous):  auto-retrain as new labeled data accumulates

Ground truth comes from recruiter actions on applications:
  applied → 0.2, shortlisted → 0.5, interview → 0.7, offered → 1.0, rejected → 0.0

Tables used:
  - ml_model_versions  — stores trained model metadata + metrics
  - ml_predictions     — logs every prediction for auditing + retraining
"""

import os
import json
import time
import uuid
import pickle
import numpy as np
import psycopg

import config

# ── Constants ────────────────────────────────────────────────────────────────

FEATURE_NAMES = [
    "structure", "skill", "experience", "content",
    "keyword", "format", "completeness",
    "embedding_quality", "topic_coherence",
]

MODEL_NAME = "ats_score_xgboost"
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
MODEL_PATH = os.path.join(MODEL_DIR, "ats_xgboost.pkl")

# Minimum labeled samples required before training
MIN_TRAINING_SAMPLES = 50

# Confidence threshold — only use ML prediction if model is this confident
CONFIDENCE_THRESHOLD = 0.6

# Ground truth label mapping: application status → quality score
OUTCOME_LABELS = {
    "applied": 0.2,
    "shortlisted": 0.5,
    "interview": 0.7,
    "offered": 1.0,
    "rejected": 0.0,
    "withdrawn": None,  # exclude from training
}


# ── Database helpers ─────────────────────────────────────────────────────────

def _get_conn():
    return psycopg.connect(config.DATABASE_URL)


def _get_active_model_id() -> str | None:
    """Get the model_id of the currently active ATS scoring model."""
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT model_id FROM ml_model_versions
                WHERE model_name = %s AND is_active = true
                ORDER BY created_at DESC LIMIT 1
                """,
                (MODEL_NAME,),
            )
            row = cur.fetchone()
            return str(row[0]) if row else None


# ── Feature Logging ──────────────────────────────────────────────────────────

def log_prediction(
    user_id: str,
    resume_id: str,
    feature_scores: dict,
    overall_score: int,
    source: str = "deterministic",
    confidence: float | None = None,
    latency_ms: int | None = None,
):
    """
    Log an ATS score prediction into ml_predictions for auditing and future training.

    Args:
        user_id: The user who uploaded the resume
        resume_id: The resume being scored
        feature_scores: The 9 individual factor scores
        overall_score: The final ATS score (0-100)
        source: "deterministic" or "ml_model"
        confidence: Model confidence (None for deterministic)
        latency_ms: Scoring latency
    """
    model_id = _get_active_model_id()

    # If no model registered yet, create a placeholder for the deterministic scorer
    if not model_id:
        model_id = _ensure_deterministic_model()

    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO ml_predictions
                    (prediction_id, model_id, user_id, entity_type, entity_id,
                     input_data, output_data, confidence_score, explanation, latency_ms)
                VALUES (%s, %s, %s, 'resume', %s, %s::jsonb, %s::jsonb, %s, %s::jsonb, %s)
                """,
                (
                    str(uuid.uuid4()),
                    model_id,
                    user_id,
                    resume_id,
                    json.dumps(feature_scores),
                    json.dumps({"overall_score": overall_score, "source": source}),
                    confidence,
                    json.dumps({
                        "feature_contributions": {
                            k: round(v, 3) for k, v in feature_scores.items()
                        },
                        "scoring_method": source,
                    }),
                    latency_ms,
                ),
            )
            conn.commit()


def _ensure_deterministic_model() -> str:
    """Register the deterministic scorer as a model version if not exists."""
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT model_id FROM ml_model_versions
                WHERE model_name = %s AND model_version = 'deterministic-v1'
                """,
                (MODEL_NAME,),
            )
            row = cur.fetchone()
            if row:
                return str(row[0])

            model_id = str(uuid.uuid4())
            cur.execute(
                """
                INSERT INTO ml_model_versions
                    (model_id, model_name, model_version, model_type, config, is_active, deployed_at)
                VALUES (%s, %s, 'deterministic-v1', 'rule_based', %s::jsonb, true, NOW())
                """,
                (
                    model_id,
                    MODEL_NAME,
                    json.dumps({
                        "weights": {
                            "structure": 0.15, "skill": 0.20, "experience": 0.15,
                            "content": 0.12, "keyword": 0.08, "format": 0.05,
                            "completeness": 0.05, "embedding_quality": 0.10,
                            "topic_coherence": 0.10,
                        },
                        "description": "Deterministic ATS scoring with fixed weights",
                    }),
                ),
            )
            conn.commit()
            return model_id


# ── Training Data Collection ─────────────────────────────────────────────────

def _collect_training_data() -> tuple[np.ndarray, np.ndarray] | None:
    """
    Collect labeled training data by joining:
      - ml_predictions (feature vectors for resume scores)
      - applications (recruiter decisions as labels)

    Returns (X, y) arrays or None if insufficient data.
    """
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    p.input_data,
                    a.status
                FROM ml_predictions p
                JOIN applications a ON a.resume_id = p.entity_id::uuid
                WHERE p.entity_type = 'resume'
                  AND a.status IS NOT NULL
                  AND a.status != 'withdrawn'
                ORDER BY p.created_at DESC
                LIMIT 10000
                """
            )
            rows = cur.fetchall()

    if len(rows) < MIN_TRAINING_SAMPLES:
        return None

    X_list = []
    y_list = []

    for input_data, status in rows:
        label = OUTCOME_LABELS.get(status)
        if label is None:
            continue

        features = input_data if isinstance(input_data, dict) else json.loads(input_data)
        feature_vector = [features.get(name, 0.0) for name in FEATURE_NAMES]
        X_list.append(feature_vector)
        y_list.append(label)

    if len(X_list) < MIN_TRAINING_SAMPLES:
        return None

    return np.array(X_list, dtype=np.float32), np.array(y_list, dtype=np.float32)


# ── Model Training ───────────────────────────────────────────────────────────

def train_model() -> dict:
    """
    Train an XGBoost regression model on collected hiring outcome data.

    Returns:
        {
            "success": bool,
            "message": str,
            "model_id": str | None,
            "metrics": dict | None,
            "samples_used": int,
        }
    """
    from xgboost import XGBRegressor
    from sklearn.model_selection import cross_val_score

    # Collect training data
    data = _collect_training_data()
    if data is None:
        return {
            "success": False,
            "message": f"Not enough labeled data. Need at least {MIN_TRAINING_SAMPLES} samples.",
            "model_id": None,
            "metrics": None,
            "samples_used": 0,
        }

    X, y = data
    n_samples = len(X)

    # Train XGBoost regressor
    model = XGBRegressor(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_alpha=0.1,
        reg_lambda=1.0,
        objective="reg:squarederror",
        random_state=42,
    )

    # Cross-validation for metrics
    cv_folds = min(5, n_samples // 10) if n_samples >= 50 else 3
    cv_scores = cross_val_score(model, X, y, cv=cv_folds, scoring="r2")
    mae_scores = -cross_val_score(model, X, y, cv=cv_folds, scoring="neg_mean_absolute_error")

    # Train on full dataset
    model.fit(X, y)

    # Feature importances (learned weights)
    importances = dict(zip(FEATURE_NAMES, model.feature_importances_.tolist()))

    # Save model to disk
    os.makedirs(MODEL_DIR, exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)

    # Compute metrics
    metrics = {
        "r2_mean": round(float(cv_scores.mean()), 4),
        "r2_std": round(float(cv_scores.std()), 4),
        "mae_mean": round(float(mae_scores.mean()), 4),
        "mae_std": round(float(mae_scores.std()), 4),
        "feature_importances": {k: round(v, 4) for k, v in importances.items()},
        "n_samples": n_samples,
        "cv_folds": cv_folds,
    }

    # Determine version number
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM ml_model_versions WHERE model_name = %s AND model_type = 'xgboost'",
                (MODEL_NAME,),
            )
            version_count = cur.fetchone()[0]

    version = f"xgb-v{version_count + 1}"
    model_id = str(uuid.uuid4())

    # Register new model version and make it active
    with _get_conn() as conn:
        with conn.cursor() as cur:
            # Deactivate all previous models
            cur.execute(
                "UPDATE ml_model_versions SET is_active = false WHERE model_name = %s",
                (MODEL_NAME,),
            )

            # Insert new model version
            cur.execute(
                """
                INSERT INTO ml_model_versions
                    (model_id, model_name, model_version, model_type, config,
                     accuracy, is_active, deployed_at)
                VALUES (%s, %s, %s, 'xgboost', %s::jsonb, %s, true, NOW())
                """,
                (
                    model_id,
                    MODEL_NAME,
                    version,
                    json.dumps({
                        "feature_names": FEATURE_NAMES,
                        "feature_importances": importances,
                        "hyperparameters": {
                            "n_estimators": 100,
                            "max_depth": 4,
                            "learning_rate": 0.1,
                        },
                        "metrics": metrics,
                        "model_path": MODEL_PATH,
                    }),
                    metrics["r2_mean"],
                ),
            )
            conn.commit()

    return {
        "success": True,
        "message": f"Model {version} trained on {n_samples} samples",
        "model_id": model_id,
        "metrics": metrics,
        "samples_used": n_samples,
    }


# ── Model Loading ────────────────────────────────────────────────────────────

_cached_model = None
_cached_model_mtime = 0.0


def _load_model():
    """Load the trained XGBoost model from disk with caching."""
    global _cached_model, _cached_model_mtime

    if not os.path.exists(MODEL_PATH):
        return None

    mtime = os.path.getmtime(MODEL_PATH)
    if _cached_model is not None and mtime == _cached_model_mtime:
        return _cached_model

    with open(MODEL_PATH, "rb") as f:
        _cached_model = pickle.load(f)
        _cached_model_mtime = mtime

    return _cached_model


# ── ML Prediction ────────────────────────────────────────────────────────────

def ml_predict(feature_scores: dict) -> tuple[int, float] | None:
    """
    Predict ATS score using the trained ML model.

    Args:
        feature_scores: Dict of 9 factor scores from ats_scorer.

    Returns:
        (predicted_score, confidence) or None if no model available.
    """
    model = _load_model()
    if model is None:
        return None

    feature_vector = np.array(
        [[feature_scores.get(name, 0.0) for name in FEATURE_NAMES]],
        dtype=np.float32,
    )

    # Predict quality score (0.0 - 1.0)
    raw_prediction = float(model.predict(feature_vector)[0])
    predicted_score = max(0, min(100, round(raw_prediction * 100)))

    # Compute confidence based on how far the prediction is from the edges
    # (predictions near 0.5 are less confident than near 0 or 1)
    # Also factor in the model's training metrics
    prediction_certainty = 1.0 - 2.0 * abs(raw_prediction - 0.5)
    base_confidence = 0.5 + 0.5 * (1.0 - prediction_certainty)

    # Adjust by checking if features are within training distribution
    feature_values = feature_vector[0]
    in_range = sum(1 for v in feature_values if 0.0 <= v <= 1.0)
    range_confidence = in_range / len(FEATURE_NAMES)

    confidence = round(base_confidence * range_confidence, 4)

    return predicted_score, confidence


# ── Hybrid Scorer ────────────────────────────────────────────────────────────

def hybrid_score(feature_scores: dict, deterministic_score: int) -> dict:
    """
    Combine ML prediction with deterministic score.

    Strategy:
      - If ML model exists and confidence >= threshold → use ML score
      - Otherwise → fall back to deterministic score
      - Always return both for transparency

    Args:
        feature_scores: The 9 individual factor scores
        deterministic_score: Score from the rule-based engine

    Returns:
        {
            "overall_score": int,
            "source": "ml_model" | "deterministic",
            "ml_score": int | None,
            "ml_confidence": float | None,
            "deterministic_score": int,
        }
    """
    ml_result = ml_predict(feature_scores)

    if ml_result is not None:
        ml_score, ml_confidence = ml_result

        if ml_confidence >= CONFIDENCE_THRESHOLD:
            # Blend: 70% ML + 30% deterministic for stability
            blended = round(0.7 * ml_score + 0.3 * deterministic_score)
            blended = max(0, min(100, blended))

            return {
                "overall_score": blended,
                "source": "ml_model",
                "ml_score": ml_score,
                "ml_confidence": ml_confidence,
                "deterministic_score": deterministic_score,
            }

        # Low confidence — still return ML info but use deterministic
        return {
            "overall_score": deterministic_score,
            "source": "deterministic",
            "ml_score": ml_score,
            "ml_confidence": ml_confidence,
            "deterministic_score": deterministic_score,
        }

    # No ML model available
    return {
        "overall_score": deterministic_score,
        "source": "deterministic",
        "ml_score": None,
        "ml_confidence": None,
        "deterministic_score": deterministic_score,
    }


# ── Training Status ──────────────────────────────────────────────────────────

def get_training_status() -> dict:
    """
    Check if enough data exists to train or retrain the model.

    Returns:
        {
            "can_train": bool,
            "samples_available": int,
            "samples_needed": int,
            "current_model": str | None,
            "last_trained": str | None,
        }
    """
    with _get_conn() as conn:
        with conn.cursor() as cur:
            # Count available labeled samples
            cur.execute(
                """
                SELECT COUNT(*)
                FROM ml_predictions p
                JOIN applications a ON a.resume_id = p.entity_id::uuid
                WHERE p.entity_type = 'resume'
                  AND a.status IS NOT NULL
                  AND a.status != 'withdrawn'
                """
            )
            sample_count = cur.fetchone()[0]

            # Get current active model info
            cur.execute(
                """
                SELECT model_version, model_type, deployed_at
                FROM ml_model_versions
                WHERE model_name = %s AND is_active = true
                ORDER BY created_at DESC LIMIT 1
                """,
                (MODEL_NAME,),
            )
            model_row = cur.fetchone()

    return {
        "can_train": sample_count >= MIN_TRAINING_SAMPLES,
        "samples_available": sample_count,
        "samples_needed": max(0, MIN_TRAINING_SAMPLES - sample_count),
        "current_model": model_row[0] if model_row else None,
        "model_type": model_row[1] if model_row else None,
        "last_trained": str(model_row[2]) if model_row and model_row[2] else None,
    }
