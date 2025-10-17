/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const [household, setHousehold] = useState<any>(null);
  const [membership, setMembership] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    fetchHouseholdData();
  }, [user]);

  const fetchHouseholdData = async () => {
    setLoading(true);
    try {
      // Get user's membership
      const { data: membershipData } = await supabase
        .from('membership')
        .select('*, household:household_id(*)')
        .eq('user_id', user?.id)
        .single();

      if (membershipData) {
        setMembership(membershipData);
        setHousehold(membershipData.household);

        // Get all members
        const { data: membersData } = await supabase
          .from('membership')
          .select('*')
          .eq('household_id', membershipData.household_id);

        if (membersData) {
          setMembers(membersData);
        }

        // Get linked accounts
        const { data: accountsData } = await supabase
          .from('account')
          .select('*')
          .eq('household_id', membershipData.household_id);

        if (accountsData) {
          setAccounts(accountsData);
        }
      }
    } catch (error) {
      console.error('Failed to fetch household data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/sign-in');
        },
      },
    ]);
  };

  const handleConnectBank = () => {
    Alert.alert(
      'Connect Bank Account',
      'Plaid Link integration will be available soon.',
      [{ text: 'OK' }]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* User Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email}</Text>
        </View>
      </View>

      {/* Household Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Household</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{household?.name || 'N/A'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Your Role</Text>
          <Text style={styles.value}>{membership?.role || 'N/A'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Members</Text>
          <Text style={styles.value}>{members.length}</Text>
        </View>
      </View>

      {/* Linked Accounts */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Linked Accounts</Text>
        {accounts.length > 0 ? (
          accounts.map((account) => {
            const displayName =
              account.account_name || account.institution || 'Bank Account';
            const typeParts = [
              account.account_type,
              account.account_subtype,
            ].filter(Boolean);
            const displayType = typeParts.length > 0 ? typeParts.join(' • ') : 'Account';

            return (
              <View key={account.id} style={styles.card}>
                <Text style={styles.value}>{displayName}</Text>
                <Text style={styles.subtext}>{displayType}</Text>
                {account.mask && (
                  <Text style={styles.subtext}>•••• {account.mask}</Text>
                )}
              </View>
            );
          })
        ) : (
          <View style={styles.card}>
            <Text style={styles.emptyText}>No accounts linked</Text>
          </View>
        )}

        <TouchableOpacity style={styles.linkButton} onPress={handleConnectBank}>
          <Text style={styles.linkButtonText}>+ Connect Bank Account</Text>
        </TouchableOpacity>
      </View>

      {/* Monthly Income */}
      {membership?.income_monthly && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Split Settings</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Monthly Income</Text>
            <Text style={styles.value}>
              ${membership.income_monthly.toLocaleString()}
            </Text>
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* App Info */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Evenly v0.1.0</Text>
        <Text style={styles.footerText}>Privacy-first expense splitting</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  label: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  subtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  linkButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  linkButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: '#FF3B30',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  signOutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
});
