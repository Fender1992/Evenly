/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export default function OnboardingScreen() {
  const [householdName, setHouseholdName] = useState('');
  const [income, setIncome] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const handleCreateHousehold = async () => {
    if (!householdName) {
      Alert.alert('Error', 'Please enter a household name');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'Not authenticated');
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const trimmedIncome = income.trim();
      const incomeValue = trimmedIncome ? Number(trimmedIncome) : null;
      if (incomeValue !== null && Number.isNaN(incomeValue)) {
        throw new Error('Monthly income must be a valid number');
      }

      const response = await fetch(`${API_BASE_URL}/api/households`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: householdName.trim(),
          incomeMonthly: incomeValue,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || 'Failed to create household');
      }

      // Navigate to app
      router.replace('/(app)/home');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create household');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Set Up Your Household</Text>
        <Text style={styles.subtitle}>
          Create a household to start splitting expenses
        </Text>

        <Text style={styles.label}>Household Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Smith Family"
          value={householdName}
          onChangeText={setHouseholdName}
          editable={!loading}
        />

        <Text style={styles.label}>Monthly Income (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., 5000"
          value={income}
          onChangeText={setIncome}
          keyboardType="numeric"
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleCreateHousehold}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Creating...' : 'Create Household'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.note}>
          You can invite other members and adjust settings later
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  note: {
    marginTop: 16,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});
