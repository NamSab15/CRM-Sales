import os
import json
import asyncio
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import create_engine, text
import chromadb
from openai import OpenAI

app = FastAPI(title="SalesFlow AI - Sales Assistant")

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://crm_user:crm_password@postgres:5432/crm_db")
engine = create_engine(DATABASE_URL)

# ChromaDB configuration (persisted local database)
CHROMA_PATH = os.getenv("CHROMA_PATH", "./chroma_db")
chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)

class ChatRequest(BaseModel):
    leadId: str
    message: str

# Helper to fetch all timeline/history records for a lead
def fetch_lead_history(lead_id: str):
    # 1. Fetch Lead details
    query_lead = text("""
        SELECT name, company, email, status, source, "createdAt" FROM "Lead" WHERE id = :lead_id
    """)
    # 2. Fetch Call logs
    query_calls = text("""
        SELECT notes, duration, "calledAt" FROM "CallLog" WHERE "leadId" = :lead_id ORDER BY "calledAt" DESC
    """)
    # 3. Fetch Followups
    query_followups = text("""
        SELECT type, status, notes, "scheduledAt", "completedAt" FROM "FollowUp" WHERE "leadId" = :lead_id ORDER BY "scheduledAt" DESC
    """)
    # 4. Fetch Deal stage changes
    query_deal_history = text("""
        SELECT d.value, d.probability, fs.name as from_stage, ts.name as to_stage, dh."changedAt"
        FROM "DealStageHistory" dh
        JOIN "Deal" d ON dh."dealId" = d.id
        JOIN "PipelineStage" fs ON dh."fromStageId" = fs.id
        JOIN "PipelineStage" ts ON dh."toStageId" = ts.id
        WHERE d."leadId" = :lead_id
        ORDER BY dh."changedAt" DESC
    """)
    # 5. Fetch Campaign Emails Sent
    query_emails = text("""
        SELECT el."sentAt", c.name as campaign_name, c.subject
        FROM "EmailLog" el
        JOIN "Lead" l ON el.recipient = l.email
        JOIN "Campaign" c ON el."campaignId" = c.id
        WHERE l.id = :lead_id
        ORDER BY el."sentAt" DESC
    """)

    with engine.connect() as conn:
        lead = conn.execute(query_lead, {"lead_id": lead_id}).fetchone()
        if not lead:
            raise HTTPException(status_code=404, detail=f"Lead with ID {lead_id} not found")
        
        calls = conn.execute(query_calls, {"lead_id": lead_id}).fetchall()
        followups = conn.execute(query_followups, {"lead_id": lead_id}).fetchall()
        deals_history = conn.execute(query_deal_history, {"lead_id": lead_id}).fetchall()
        emails = conn.execute(query_emails, {"lead_id": lead_id}).fetchall()

    chunks = []
    
    # Lead Profile Chunk
    created_date = lead[5].strftime('%Y-%m-%d') if isinstance(lead[5], datetime) else str(lead[5])
    chunks.append(
        f"Lead Profile: {lead[0]} works at {lead[1]}. Email: {lead[2]}, Status: {lead[3]}, Source: {lead[4]}. Created on {created_date}."
    )

    # Call Logs
    for notes, duration, called_at in calls:
        date_str = called_at.strftime('%Y-%m-%d') if isinstance(called_at, datetime) else str(called_at)
        chunks.append(f"Call Log on {date_str}: Duration {duration} seconds. Interaction notes: {notes}")

    # Follow-ups
    for f_type, f_status, f_notes, scheduled_at, completed_at in followups:
        sched_date = scheduled_at.strftime('%Y-%m-%d') if isinstance(scheduled_at, datetime) else str(scheduled_at)
        comp_date = f", completed on {completed_at.strftime('%Y-%m-%d')}" if completed_at else ""
        chunks.append(
            f"Follow-up task of type {f_type} is currently {f_status} (scheduled for {sched_date}{comp_date}). Description: {f_notes}"
        )

    # Deals History
    for val, prob, from_s, to_s, changed_at in deals_history:
        change_date = changed_at.strftime('%Y-%m-%d') if isinstance(changed_at, datetime) else str(changed_at)
        chunks.append(
            f"Deal Update on {change_date}: Deal value is ${float(val):,.2f} with a probability of {prob}%. The pipeline stage changed from {from_s} to {to_s}."
        )

    # Campaign Emails
    for sent_at, camp_name, subj in emails:
        sent_date = sent_at.strftime('%Y-%m-%d') if isinstance(sent_at, datetime) else str(sent_at)
        chunks.append(f"Email Sent on {sent_date}: Campaign '{camp_name}' with subject '{subj}'.")

    return chunks

@app.get("/health")
def health():
    return {"status": "UP", "worker": "assistant"}

@app.get("/")
def read_root():
    return {"message": "Welcome to SalesFlow AI Assistant Worker API"}

@app.post("/analyze/{lead_id}")
async def analyze_lead(lead_id: str):
    chunks = fetch_lead_history(lead_id)
    
    # 1. Store/index history chunks in ChromaDB (Collection per lead)
    coll_name = f"lead_{lead_id}"
    
    # Clear previous collection context to avoid duplicate records
    try:
        chroma_client.delete_collection(name=coll_name)
    except Exception:
        pass
    
    collection = chroma_client.create_collection(name=coll_name)
    
    if chunks:
        collection.add(
            documents=chunks,
            ids=[f"chunk_{i}" for i in range(len(chunks))]
        )
    
    # 2. Query collection for status and risk RAG contexts
    retrieved_docs = []
    if chunks:
        results = collection.query(
            query_texts=["What is the current status and risk of this lead?"],
            n_results=min(5, len(chunks))
        )
        if results and 'documents' in results and len(results['documents']) > 0:
            retrieved_docs = results['documents'][0]
    
    # 3. Call OpenAI for analysis if key is set
    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key and openai_key != "YOUR_OPENAI_API_KEY":
        try:
            client = OpenAI(api_key=openai_key)
            
            system_prompt = "You are a CRM sales strategist. Generate a structured lead analysis report in JSON format."
            user_prompt = f"""
            Analyze the retrieved lead interactions and context below:
            
            {chr(10).join(retrieved_docs)}
            
            Based on these details, formulate a JSON response containing:
            1. 'summary': A concise summary of the lead status (2-3 sentences).
            2. 'riskLevel': A classification of risk (LOW, MEDIUM, or HIGH).
            3. 'recommendedActions': An array of recommended next steps (at least 2 strings).
            4. 'nextBestAction': The single most urgent next action to execute.
            
            Return output strictly matching the JSON schema:
            {{"summary": "...", "riskLevel": "LOW|MEDIUM|HIGH", "recommendedActions": ["...", "..."], "nextBestAction": "..."}}
            """
            
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.5
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            print(f"[assistant] OpenAI analysis error: {e}. Falling back to rule-based analysis...")

    # Rule-based fallback generator
    call_count = len([c for c in chunks if "Call Log" in c])
    followup_count = len([f for f in chunks if "Follow-up" in f])
    deal_count = len([d for d in chunks if "Deal Update" in d])
    
    risk_level = "LOW"
    rec_actions = ["Schedule a product demonstration", "Introduce the technical account manager"]
    next_action = "Email the lead to schedule a meeting"

    if "Status: LOST" in chunks[0] if chunks else False:
        risk_level = "HIGH"
        rec_actions = ["Log a post-mortem note on why the deal was lost", "Put lead on a 3-month cooling campaigns bucket"]
        next_action = "Archive the lead record"
    elif followup_count == 0:
        risk_level = "HIGH"
        rec_actions = ["Assign a follow-up executive immediately", "Verify contact email correctness"]
        next_action = "Create first follow-up call task"
    elif call_count < 2 and deal_count > 0:
        risk_level = "MEDIUM"
        rec_actions = ["Schedule an alignment call to build deal confidence", "Follow up on the pending proposal"]
        next_action = "Call the client directly to review proposals"

    summary = f"Lead profile has {call_count} calls, {followup_count} follow-ups, and {deal_count} deal modifications recorded."
    if risk_level == "HIGH":
        summary += " Lead requires immediate attention due to missing follow-ups or lost deal status."

    return {
        "summary": summary,
        "riskLevel": risk_level,
        "recommendedActions": rec_actions,
        "nextBestAction": next_action
    }

@app.post("/chat")
async def chat_rag(req: ChatRequest):
    coll_name = f"lead_{req.leadId}"
    
    # 1. Retrieve top-5 relevant chunks from lead collection
    context_chunks = []
    try:
        collection = chroma_client.get_collection(name=coll_name)
        results = collection.query(
            query_texts=[req.message],
            n_results=min(5, collection.count())
        )
        if results and 'documents' in results and len(results['documents']) > 0:
            context_chunks = results['documents'][0]
    except Exception:
        # Fallback if lead collection is not created yet
        pass

    # 2. Generator for Streaming SSE response
    async def event_generator():
        openai_key = os.getenv("OPENAI_API_KEY")
        if openai_key and openai_key != "YOUR_OPENAI_API_KEY":
            try:
                client = OpenAI(api_key=openai_key)
                
                system_prompt = "You are a CRM sales assistant. Use the retrieved context below to answer the user's question about the lead. If you do not know or the context is empty, give a professional response based on general sales best practices."
                
                context_str = "\n".join(context_chunks)
                user_prompt = f"Context:\n{context_str}\n\nQuestion: {req.message}"
                
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    stream=True,
                    temperature=0.7
                )
                
                for chunk in response:
                    text_delta = chunk.choices[0].delta.content or ""
                    if text_delta:
                        yield f"data: {json.dumps({'chunk': text_delta})}\n\n"
                        # Yield a small sleep to prevent event loop blocking
                        await asyncio.sleep(0.01)
                return
            except Exception as e:
                yield f"data: {json.dumps({'chunk': f'[Error streaming from OpenAI: {str(e)}]'})}\n\n"

        # Mock live streaming generator fallback
        mock_reply = (
            f"Here is the context regarding lead {req.leadId} from our records:\n\n"
            f"I found {len(context_chunks)} relevant items indexed. "
            f"To enable live OpenAI responses, please set the OPENAI_API_KEY key in the .env environment.\n\n"
            f"Based on CRM best practices, I suggest following up with this lead by email or checking the pending deals."
        )
        for word in mock_reply.split(" "):
            yield f"data: {json.dumps({'chunk': word + ' '})}\n\n"
            await asyncio.sleep(0.08)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
