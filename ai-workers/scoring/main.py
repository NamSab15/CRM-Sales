import os
import json
import asyncio
import uuid
from datetime import datetime
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
import redis.asyncio as aioredis
from sqlalchemy import create_engine, text
import joblib
from lightgbm import LGBMClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score

app = FastAPI(title="SalesFlow AI - Scoring Worker")

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://crm_user:crm_password@postgres:5432/crm_db")
engine = create_engine(DATABASE_URL, pool_size=5, max_overflow=10)

# Ensure models directory exists
os.makedirs("models", exist_ok=True)

def create_default_model():
    model_path = "models/lead_scorer.pkl"
    if os.path.exists(model_path):
        return
    print("[scoring]: Creating default model...")
    # Generate mock training dataset
    np.random.seed(42)
    n_samples = 100
    X = pd.DataFrame({
        'days_since_created': np.random.randint(0, 100, n_samples),
        'has_phone': np.random.choice([0, 1], n_samples),
        'has_company': np.random.choice([0, 1], n_samples),
        'source_encoded': np.random.choice([0, 1, 2, 3, 4], n_samples),
        'followup_count': np.random.randint(0, 10, n_samples),
        'call_count': np.random.randint(0, 10, n_samples),
        'email_open_count': np.random.randint(0, 10, n_samples),
        'pipeline_stage_order': np.random.randint(0, 6, n_samples)
    })
    # probability of WON
    prob = (
        X['has_phone'] * 0.15 + 
        X['has_company'] * 0.1 + 
        (X['source_encoded'] == 1) * 0.2 + # REFERRAL
        X['followup_count'] * 0.05 + 
        X['call_count'] * 0.05 + 
        X['email_open_count'] * 0.05 + 
        X['pipeline_stage_order'] * 0.1
    )
    # clip probability and draw outcomes
    prob = np.clip(prob, 0.0, 1.0)
    y = np.random.binomial(1, prob)
    
    # Train LGBM
    model = LGBMClassifier(n_estimators=10, random_state=42, verbose=-1)
    model.fit(X, y)
    
    joblib.dump(model, model_path)
    print("[scoring]: Default model created and saved successfully.")

async def score_lead_internal(lead_id: str):
    # 1. Fetch lead data from PostgreSQL
    query_lead = text("""
        SELECT 
          l.id,
          l."createdAt",
          l.phone,
          l.company,
          l.source,
          l.email,
          (SELECT COUNT(*) FROM "FollowUp" f WHERE f."leadId" = l.id) as followup_count,
          (SELECT COUNT(*) FROM "CallLog" c WHERE c."leadId" = l.id) as call_count,
          (SELECT COUNT(*) FROM "EmailLog" e WHERE e.recipient = l.email AND e."openedAt" IS NOT NULL) as email_open_count,
          COALESCE((
            SELECT ps.order 
            FROM "Deal" d
            JOIN "PipelineStage" ps ON d."currentStageId" = ps.id
            WHERE d."leadId" = l.id
            LIMIT 1
          ), 0) as pipeline_stage_order
        FROM "Lead" l
        WHERE l.id = :lead_id
    """)

    with engine.connect() as conn:
        result = conn.execute(query_lead, {"lead_id": lead_id}).fetchone()

    if not result:
        raise ValueError(f"Lead with ID {lead_id} not found")

    lead_id = result[0]
    created_at = result[1]
    phone = result[2]
    company = result[3]
    source = result[4]
    email = result[5]
    followup_count = result[6]
    call_count = result[7]
    email_open_count = result[8]
    pipeline_stage_order = result[9]

    # 2. Build feature vector
    days_since_created = max(0, (datetime.utcnow() - created_at).days)
    has_phone = 1 if phone and phone.strip() else 0
    has_company = 1 if company and company.strip() else 0

    source_map = {
        'WEBSITE': 0,
        'REFERRAL': 1,
        'COLD_CALL': 2,
        'EMAIL': 3,
        'OTHER': 4
    }
    source_encoded = source_map.get(source, 4)

    features = pd.DataFrame([{
        'days_since_created': days_since_created,
        'has_phone': has_phone,
        'has_company': has_company,
        'source_encoded': source_encoded,
        'followup_count': followup_count,
        'call_count': call_count,
        'email_open_count': email_open_count,
        'pipeline_stage_order': pipeline_stage_order
    }])

    # 3. Load model
    model_path = "models/lead_scorer.pkl"
    if not os.path.exists(model_path):
        create_default_model()
    model = joblib.load(model_path)

    # 4. Predict
    proba = model.predict_proba(features)[0]
    probability = proba[1] if len(proba) > 1 else proba[0]
    score = int(probability * 100)
    confidence = float(round(0.5 + abs(probability - 0.5) * 2 * 0.49, 2))

    # 5. Generate signals
    signals = []
    if call_count > 3:
        signals.append("High call activity")
    elif call_count == 0:
        signals.append("No calls logged yet")
        
    if followup_count > 2:
        signals.append("Consistent follow-ups logged")
    elif followup_count == 0:
        signals.append("No follow-up in place")

    if email_open_count > 2:
        signals.append("Active email engagement")

    if pipeline_stage_order >= 3:
        signals.append("Advanced pipeline stage")
        
    if has_phone == 1 and has_company == 1:
        signals.append("Complete lead contact details")
        
    if source == 'REFERRAL':
        signals.append("Lead referred from trusted channel")
        
    if days_since_created > 30 and followup_count < 2:
        signals.append("High risk: cold lead with low contact rate")

    if not signals:
        signals.append("Standard lead profile")

    # 6. Write to AILeadScore table in DB
    query_upsert = text("""
        INSERT INTO "AILeadScore" (id, "leadId", score, signals, confidence, "generatedAt", "createdAt", "updatedAt")
        VALUES (:id, :leadId, :score, :signals, :confidence, :generatedAt, :createdAt, :updatedAt)
        ON CONFLICT ("leadId") DO UPDATE SET
          score = EXCLUDED.score,
          signals = EXCLUDED.signals,
          confidence = EXCLUDED.confidence,
          "generatedAt" = EXCLUDED."generatedAt",
          "updatedAt" = EXCLUDED."updatedAt"
    """)

    upsert_params = {
        "id": str(uuid.uuid4()),
        "leadId": lead_id,
        "score": score,
        "signals": signals,
        "confidence": confidence,
        "generatedAt": datetime.utcnow(),
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
    }

    with engine.begin() as conn:
        conn.execute(query_upsert, upsert_params)

    # 7. Publish to Redis
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379")
    redis_client = aioredis.from_url(redis_url, decode_responses=True)
    
    lead_scored_payload = {
        "leadId": lead_id,
        "score": score,
        "confidence": confidence,
        "signals": signals
    }
    await redis_client.publish("lead:scored", json.dumps(lead_scored_payload))
    await redis_client.close()

    print(f"[scoring]: Calculated score {score} for lead {lead_id}")
    return lead_scored_payload

async def redis_listener():
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379")
    print(f"[scoring]: Starting Redis event listener on {redis_url}...")
    while True:
        try:
            client = aioredis.from_url(redis_url, decode_responses=True)
            pubsub = client.pubsub()
            await pubsub.subscribe("lead:created", "lead:updated")
            
            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        payload = json.loads(message["data"])
                        lead_id = payload.get("id")
                        if lead_id:
                            print(f"[scoring]: Received event for lead {lead_id}, enqueuing score calculation...")
                            await score_lead_internal(lead_id)
                    except Exception as ex:
                        print(f"[scoring]: Error processing event: {ex}")
        except Exception as e:
            print(f"[scoring]: Redis listener error: {e}. Retrying in 10 seconds...")
            await asyncio.sleep(10)

@app.on_event("startup")
async def startup_event():
    create_default_model()
    # Run Redis subscription listener as background task
    asyncio.create_task(redis_listener())

@app.get("/health")
def health():
    return {"status": "UP", "worker": "scoring"}

@app.get("/")
def read_root():
    return {"message": "Welcome to SalesFlow AI Scoring Worker API"}

@app.post("/score/{lead_id}")
async def score_lead_endpoint(lead_id: str):
    try:
        result = await score_lead_internal(lead_id)
        return result
    except ValueError as val_err:
        raise HTTPException(status_code=404, detail=str(val_err))
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))

@app.post("/train")
def train_model():
    try:
        # Load leads with WON/LOST outcomes in last 6 months
        query_train = text("""
            SELECT 
              l.id,
              l."createdAt",
              l.phone,
              l.company,
              l.source,
              l.status,
              (SELECT COUNT(*) FROM "FollowUp" f WHERE f."leadId" = l.id) as followup_count,
              (SELECT COUNT(*) FROM "CallLog" c WHERE c."leadId" = l.id) as call_count,
              (SELECT COUNT(*) FROM "EmailLog" e WHERE e.recipient = l.email AND e."openedAt" IS NOT NULL) as email_open_count,
              COALESCE((
                SELECT ps.order 
                FROM "Deal" d
                JOIN "PipelineStage" ps ON d."currentStageId" = ps.id
                WHERE d."leadId" = l.id
                LIMIT 1
              ), 0) as pipeline_stage_order
            FROM "Lead" l
            WHERE l.status IN ('WON', 'LOST')
              AND l."createdAt" >= NOW() - INTERVAL '6 months'
        """)
        
        with engine.connect() as conn:
            results = conn.execute(query_train).fetchall()
            
        # Map results to pandas DataFrame
        data = []
        for row in results:
            created_at = row[1]
            phone = row[2]
            company = row[3]
            source = row[4]
            status = row[5]
            followup_count = row[6]
            call_count = row[7]
            email_open_count = row[8]
            pipeline_stage_order = row[9]
            
            days_since_created = max(0, (datetime.utcnow() - created_at).days)
            has_phone = 1 if phone and phone.strip() else 0
            has_company = 1 if company and company.strip() else 0
            
            source_map = {'WEBSITE': 0, 'REFERRAL': 1, 'COLD_CALL': 2, 'EMAIL': 3, 'OTHER': 4}
            source_encoded = source_map.get(source, 4)
            
            label = 1 if status == 'WON' else 0
            
            data.append({
                'days_since_created': days_since_created,
                'has_phone': has_phone,
                'has_company': has_company,
                'source_encoded': source_encoded,
                'followup_count': followup_count,
                'call_count': call_count,
                'email_open_count': email_open_count,
                'pipeline_stage_order': pipeline_stage_order,
                'label': label
            })
            
        df = pd.DataFrame(data)
        
        # Check if we have enough outcomes for training, otherwise use mock dataset
        is_mocked = False
        if len(df) < 10 or df['label'].nunique() < 2:
            is_mocked = True
            print("[scoring]: Insufficient DB outcomes. Generating synthetic training dataset...")
            np.random.seed(42)
            n_samples = 150
            df = pd.DataFrame({
                'days_since_created': np.random.randint(0, 100, n_samples),
                'has_phone': np.random.choice([0, 1], n_samples),
                'has_company': np.random.choice([0, 1], n_samples),
                'source_encoded': np.random.choice([0, 1, 2, 3, 4], n_samples),
                'followup_count': np.random.randint(0, 10, n_samples),
                'call_count': np.random.randint(0, 10, n_samples),
                'email_open_count': np.random.randint(0, 10, n_samples),
                'pipeline_stage_order': np.random.randint(0, 6, n_samples),
                'label': np.random.choice([0, 1], n_samples)
            })
            
        X = df.drop(columns=['label'])
        y = df['label']
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
        
        model = LGBMClassifier(n_estimators=30, random_state=42, verbose=-1)
        model.fit(X_train, y_train)
        
        # Evaluate
        preds = model.predict(X_test)
        acc = float(accuracy_score(y_test, preds))
        prec = float(precision_score(y_test, preds, zero_division=0))
        rec = float(recall_score(y_test, preds, zero_division=0))
        
        # Save model
        model_path = "models/lead_scorer.pkl"
        joblib.dump(model, model_path)
        
        return {
            "status": "success",
            "message": "Model trained on synthetic data due to empty database" if is_mocked else "Model trained successfully on real data",
            "accuracy": acc,
            "precision": prec,
            "recall": rec,
            "samples_trained": len(df)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")
