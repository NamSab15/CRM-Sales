import os
import json
from datetime import datetime
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sqlalchemy import create_engine, text

app = FastAPI(title="SalesFlow AI - Email Generator")

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://crm_user:crm_password@postgres:5432/crm_db")
engine = create_engine(DATABASE_URL)

# Pydantic schemas
class FollowupRequest(BaseModel):
    leadId: str
    context: str

class ProposalRequest(BaseModel):
    leadId: str
    dealValue: float
    notes: str

class ReminderRequest(BaseModel):
    leadId: str
    followupType: str
    scheduledAt: str

# Database retrieval helper
def get_lead_context(lead_id: str):
    # 1. Fetch Lead
    query_lead = text("""
        SELECT id, name, company, email, status FROM "Lead" WHERE id = :lead_id
    """)
    with engine.connect() as conn:
        lead = conn.execute(query_lead, {"lead_id": lead_id}).fetchone()

    if not lead:
        raise HTTPException(status_code=404, detail=f"Lead with ID {lead_id} not found")

    lead_id_val, name, company, email, status = lead

    # 2. Fetch Deal Value (if any)
    query_deal = text("""
        SELECT value FROM "Deal" WHERE "leadId" = :lead_id LIMIT 1
    """)
    with engine.connect() as conn:
        deal = conn.execute(query_deal, {"lead_id": lead_id}).fetchone()
    deal_value = float(deal[0]) if deal else None

    # 3. Fetch last 3 interactions (union of call log, followup log, email log)
    query_interactions = text("""
        (SELECT 'call' as type, notes, "calledAt" as t FROM "CallLog" WHERE "leadId" = :lead_id)
        UNION ALL
        (SELECT 'followup' as type, notes, "scheduledAt" as t FROM "FollowUp" WHERE "leadId" = :lead_id)
        UNION ALL
        (SELECT 'email' as type, 'Sent campaign email' as notes, "sentAt" as t FROM "EmailLog" el 
         JOIN "Lead" l ON el.recipient = l.email WHERE l.id = :lead_id)
        ORDER BY t DESC
        LIMIT 3
    """)
    with engine.connect() as conn:
        interactions_res = conn.execute(query_interactions, {"lead_id": lead_id}).fetchall()
    
    interactions = []
    for type_val, notes, t_val in interactions_res:
        date_str = t_val.strftime('%Y-%m-%d') if isinstance(t_val, datetime) else str(t_val)
        interactions.append(f"- {type_val.upper()} ({date_str}): {notes}")
    interactions_text = "\n".join(interactions) if interactions else "No previous interactions found."

    return {
        "name": name,
        "company": company,
        "email": email,
        "status": status,
        "deal_value": deal_value,
        "interactions": interactions_text
    }

# LLM execution helper
def call_llm(system_prompt: str, user_prompt: str, fallback_email: dict) -> dict:
    openai_key = os.getenv("OPENAI_API_KEY")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    
    if openai_key and openai_key != "YOUR_OPENAI_API_KEY":
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_key)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.7
            )
            content = response.choices[0].message.content
            return json.loads(content)
        except Exception as e:
            print(f"[email-gen] OpenAI error: {e}. Falling back...")
            
    if anthropic_key and anthropic_key != "YOUR_ANTHROPIC_API_KEY":
        try:
            from anthropic import Anthropic
            client = Anthropic(api_key=anthropic_key)
            system_with_json = system_prompt + "\nYou must return your output strictly in JSON format matching the schema: {\"subject\": \"...\", \"body\": \"...\", \"tone\": \"...\"}."
            message = client.messages.create(
                model="claude-3-5-sonnet-20240620",
                max_tokens=1000,
                temperature=0.7,
                system=system_with_json,
                messages=[
                    {"role": "user", "content": user_prompt}
                ]
            )
            content = message.content[0].text
            return json.loads(content)
        except Exception as e:
            print(f"[email-gen] Anthropic error: {e}. Falling back...")
            
    return fallback_email

@app.get("/health")
def health():
    return {"status": "UP", "worker": "email-gen"}

@app.get("/")
def read_root():
    return {"message": "Welcome to SalesFlow AI Email-gen Worker API"}

@app.post("/generate/followup")
async def generate_followup(req: FollowupRequest):
    lead_ctx = get_lead_context(req.leadId)
    
    system_prompt = "You are a CRM sales assistant. Generate professional emails. Return JSON with 'subject', 'body', and 'tone' (e.g. professional, friendly, persuasive)."
    
    user_prompt = f"""
    Generate a follow-up email to the lead based on the following details:
    Lead Name: {lead_ctx['name']}
    Company: {lead_ctx['company']}
    Lead Status: {lead_ctx['status']}
    Last Interactions:
    {lead_ctx['interactions']}
    
    Additional Context for follow-up: {req.context}
    
    Format output as JSON with 'subject', 'body', and 'tone' keys.
    """
    
    fallback_followup = {
        "subject": f"Next steps: SalesFlow CRM consultation for {lead_ctx['company']}",
        "body": f"Dear {lead_ctx['name']},\n\nI hope this email finds you well.\n\nFollowing up on our recent conversations and looking at {req.context}, I wanted to see if you have any questions regarding the integrations we proposed. We are keen on supporting {lead_ctx['company']} in optimizing operations.\n\nDo you have 10 minutes for a brief call next week to discuss next steps?\n\nBest regards,\nSales Team",
        "tone": "professional"
    }
    
    result = call_llm(system_prompt, user_prompt, fallback_followup)
    return result

@app.post("/generate/proposal")
async def generate_proposal(req: ProposalRequest):
    lead_ctx = get_lead_context(req.leadId)
    
    system_prompt = "You are a CRM sales assistant. Generate professional emails. Return JSON with 'subject', 'body', and 'tone' (e.g. professional, friendly, persuasive)."
    
    deal_value = req.dealValue or lead_ctx['deal_value'] or 0.0
    
    user_prompt = f"""
    Generate a business proposal email to the lead based on the following details:
    Lead Name: {lead_ctx['name']}
    Company: {lead_ctx['company']}
    Deal Value: ${deal_value:,.2f}
    Last Interactions:
    {lead_ctx['interactions']}
    
    Proposal Notes: {req.notes}
    
    Format output as JSON with 'subject', 'body', and 'tone' keys.
    """
    
    fallback_proposal = {
        "subject": f"Proposal: SalesFlow CRM Solution for {lead_ctx['company']}",
        "body": f"Dear {lead_ctx['name']},\n\nIt was a pleasure discussing your CRM goals for {lead_ctx['company']}.\n\nBased on your requirements, we have structured a custom package valued at ${deal_value:,.2f}. This proposal covers all scope items, onboarding plans, and integrations outlined in our notes: '{req.notes}'.\n\nPlease let me know if you would like to proceed or schedule a review call.\n\nBest regards,\nSales Team",
        "tone": "persuasive"
    }
    
    result = call_llm(system_prompt, user_prompt, fallback_proposal)
    return result

@app.post("/generate/reminder")
async def generate_reminder(req: ReminderRequest):
    lead_ctx = get_lead_context(req.leadId)
    
    system_prompt = "You are a CRM sales assistant. Generate professional emails. Return JSON with 'subject', 'body', and 'tone' (e.g. professional, friendly, persuasive)."
    
    user_prompt = f"""
    Generate a quick reminder email to the lead about their upcoming scheduled event:
    Lead Name: {lead_ctx['name']}
    Company: {lead_ctx['company']}
    Event Type: {req.followupType}
    Scheduled At: {req.scheduledAt}
    
    Format output as JSON with 'subject', 'body', and 'tone' keys.
    """
    
    fallback_reminder = {
        "subject": f"Reminder: Upcoming {req.followupType} meeting",
        "body": f"Dear {lead_ctx['name']},\n\nThis is a friendly reminder that we have a {req.followupType} scheduled for {req.scheduledAt}.\n\nWe look forward to speaking and aligning on how SalesFlow CRM can help {lead_ctx['company']}.\n\nIf you need to reschedule, please feel free to reach out.\n\nBest regards,\nSales Team",
        "tone": "friendly"
    }
    
    result = call_llm(system_prompt, user_prompt, fallback_reminder)
    return result
