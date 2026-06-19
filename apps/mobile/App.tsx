import * as React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { Lead, LeadSource, LeadStatus } from '@crm/shared-types';

const mockLeads: Lead[] = [
  {
    id: 'm1',
    name: 'Elon Musk',
    email: 'elon@spacex.com',
    company: 'SpaceX',
    phone: '555-0299',
    source: LeadSource.WEBSITE,
    status: LeadStatus.PROPOSAL,
    score: 99,
    assignedTo: 'u1',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'm2',
    name: 'Tim Cook',
    email: 'tcook@apple.com',
    company: 'Apple',
    phone: '555-0200',
    source: LeadSource.REFERRAL,
    status: LeadStatus.NEGOTIATION,
    score: 95,
    assignedTo: 'u2',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>SalesFlow AI</Text>
          <Text style={styles.subtitle}>Mobile Lead Assistant</Text>
        </View>

        <Text style={styles.sectionTitle}>High Priority Leads</Text>

        {mockLeads.map((lead) => (
          <View key={lead.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.leadName}>{lead.name}</Text>
              <Text style={styles.leadScore}>{lead.score}% Score</Text>
            </View>
            <Text style={styles.leadCompany}>{lead.company}</Text>
            <Text style={styles.leadEmail}>{lead.email}</Text>
            
            <View style={styles.badgeRow}>
              <View style={[styles.badge, styles.statusBadge]}>
                <Text style={styles.badgeText}>{lead.status}</Text>
              </View>
              <TouchableOpacity style={styles.button}>
                <Text style={styles.buttonText}>Call Lead</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
    marginTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  leadName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  leadScore: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10B981',
  },
  leadCompany: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 2,
  },
  leadEmail: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 9999,
  },
  statusBadge: {
    backgroundColor: '#E1EFFE',
  },
  badgeText: {
    fontSize: 12,
    color: '#1E429F',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  button: {
    backgroundColor: '#4F46E5',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
