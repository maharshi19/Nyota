import json
import math
import os
import sys

import joblib
import numpy as np
import pandas as pd


_MODEL_CACHE = {}


def _to_number(value, fallback):
    try:
        parsed = float(value)
        if math.isfinite(parsed):
            return parsed
        return fallback
    except Exception:
        return fallback


def _load_model(model_path):
    cached = _MODEL_CACHE.get(model_path)
    if cached is not None:
        return cached
    model = joblib.load(model_path)
    _MODEL_CACHE[model_path] = model
    return model


def _build_feature_row(model, raw_features):
    sbp = _to_number(raw_features.get("sbp"), 120.0)
    map_value = _to_number(raw_features.get("map"), 90.0)
    pulse_pressure = _to_number(raw_features.get("pulse_pressure"), max(35.0, sbp - map_value))
    heat_index = _to_number(raw_features.get("heat_island_index"), 50.0)
    age = _to_number(raw_features.get("age"), 28.0)

    direct = {}
    for key, value in raw_features.items():
        direct[str(key)] = _to_number(value, 0.0)

    aliases = {
        "sbp": sbp,
        "systolic_bp": sbp,
        "systolic": sbp,
        "map": map_value,
        "mean_arterial_pressure": map_value,
        "pulse_pressure": pulse_pressure,
        "pp": pulse_pressure,
        "heat_island_index": heat_index,
        "heat_index": heat_index,
        "age": age,
    }

    feature_names = getattr(model, "feature_names_in_", None)
    if feature_names is None:
        vec = [sbp, map_value, pulse_pressure, heat_index, age]
        return np.array([vec], dtype=float), {
            "sbp": sbp,
            "map": map_value,
            "pulse_pressure": pulse_pressure,
            "heat_island_index": heat_index,
            "age": age,
        }

    row = {}
    for name in feature_names:
        if name in direct:
            row[name] = direct[name]
        elif name in aliases:
            row[name] = aliases[name]
        else:
            row[name] = 0.0

    return pd.DataFrame([row]), {
        "sbp": sbp,
        "map": map_value,
        "pulse_pressure": pulse_pressure,
        "heat_island_index": heat_index,
        "age": age,
    }


def _predict_probability(model, x):
    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(x)
        if len(probs.shape) == 2 and probs.shape[1] >= 2:
            return float(probs[0][1])
        return float(probs[0][0])

    if hasattr(model, "decision_function"):
        score = float(model.decision_function(x)[0])
        return float(1.0 / (1.0 + math.exp(-score)))

    pred = model.predict(x)
    return float(pred[0]) if len(pred) > 0 else 0.01


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing payload argument"}))
        sys.exit(1)

    try:
        payload = json.loads(sys.argv[1])
        model_path = payload.get("modelPath")
        if not model_path or not os.path.exists(model_path):
            print(json.dumps({"error": "Model path not found"}))
            sys.exit(1)

        features = payload.get("features") or {}
        model = _load_model(model_path)
        x, used_features = _build_feature_row(model, features)
        prediction = _predict_probability(model, x)
        prediction = max(0.01, min(0.99, prediction))

        confidence = 0.55 + min(abs(prediction - 0.5) * 0.9, 0.4)
        confidence = max(0.55, min(0.99, confidence))

        print(json.dumps({
            "prediction": prediction,
            "confidence": confidence,
            "features": used_features,
            "modelType": type(model).__name__,
            "usedRealModel": True,
        }))
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
