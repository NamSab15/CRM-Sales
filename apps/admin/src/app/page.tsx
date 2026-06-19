'use client';

import * as React from 'react';
import { Button, Card, Badge } from '@crm/ui';
import { User, UserRole } from '@crm/shared-types';

const mockUsers: User[] = [
  {
    id: 'u1',
    name: 'Alice Smith',
    email: 'alice@salesflow.ai',
    role: UserRole.ADMIN,
    teamId: 't1',
    createdAt: new Date(),
  },
  {
    id: 'u2',
    name: 'Bob Jones',
    email: 'bob@salesflow.ai',
    role: UserRole.SALES_EXECUTIVE,
    teamId: 't1',
    createdAt: new Date(),
  },
];

export default function AdminPage() {
  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#111827' }}>CRM Admin Control Panel</h1>
          <p style={{ margin: '8px 0 0 0', color: '#6B7280' }}>Manage workspace parameters, active users, and service metrics.</p>
        </div>
        <Button variant="danger">System Shutdown</Button>
      </header>

      <main style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '32px' }}>
        <section>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', marginBottom: '20px' }}>Active System Users</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {mockUsers.map((user) => (
              <Card key={user.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#111827' }}>{user.name}</h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6B7280' }}>{user.email}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Badge color={user.role === UserRole.ADMIN ? 'red' : 'gray'}>{user.role}</Badge>
                  <Button variant="secondary" size="sm">Edit Privileges</Button>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <aside>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', marginBottom: '20px' }}>Service Status</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Card hoverable={false} style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '500' }}>API Gateway</span>
                <Badge color="green">Healthy</Badge>
              </div>
            </Card>
            <Card hoverable={false} style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '500' }}>Lead Service</span>
                <Badge color="green">Healthy</Badge>
              </div>
            </Card>
            <Card hoverable={false} style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '500' }}>AI Assistant</span>
                <Badge color="green">Healthy</Badge>
              </div>
            </Card>
          </div>
        </aside>
      </main>
    </div>
  );
}
