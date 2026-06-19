'use client';

import * as React from 'react';
import { Button, Card, Badge } from '@crm/ui';
import { Lead, LeadSource, LeadStatus } from '@crm/shared-types';

const mockLeads: Lead[] = [
  {
    id: '1',
    name: 'Sarah Connor',
    email: 'sarah@cyberdyne.com',
    company: 'Cyberdyne Systems',
    phone: '555-0199',
    source: LeadSource.WEBSITE,
    status: LeadStatus.QUALIFIED,
    score: 94,
    assignedTo: 'u1',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    name: 'John Connor',
    email: 'john@resistance.net',
    company: 'Resistance HQ',
    phone: '555-0100',
    source: LeadSource.REFERRAL,
    status: LeadStatus.NEW,
    score: 88,
    assignedTo: 'u2',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export default function DashboardPage() {
  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#111827' }}>SalesFlow AI CRM</h1>
          <p style={{ margin: '8px 0 0 0', color: '#6B7280' }}>Welcome back, Sales Representative</p>
        </div>
        <Button variant="primary">New Lead</Button>
      </header>

      <main>
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '40px' }}>
          <Card>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Active Leads</h3>
            <p style={{ margin: 0, fontSize: '36px', fontWeight: 'bold', color: '#111827' }}>248</p>
          </Card>
          <Card>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Opportunity Score</h3>
            <p style={{ margin: 0, fontSize: '36px', fontWeight: 'bold', color: '#10B981' }}>87%</p>
          </Card>
          <Card>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Monthly Target</h3>
            <p style={{ margin: 0, fontSize: '36px', fontWeight: 'bold', color: '#111827' }}>$45k / $60k</p>
          </Card>
        </section>

        <section>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', marginBottom: '20px' }}>High Score AI Leads</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {mockLeads.map((lead) => (
              <Card key={lead.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#111827' }}>{lead.name}</h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6B7280' }}>{lead.company} &bull; {lead.email}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Badge color={lead.status === LeadStatus.QUALIFIED ? 'green' : 'blue'}>{lead.status}</Badge>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#10B981' }}>Score: {lead.score}</span>
                  <Button variant="secondary" size="sm">Details</Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
