/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useHouseholdSummary } from '../../hooks/useHouseholdSummary';
import { useBudgets } from '../../hooks/useBudgets';

export default function HomeScreen() {
  const { user } = useAuth();
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [currentMonth] = useState(new Date().toISOString().slice(0, 7));
  const router = useRouter();

  const { data: summary, isLoading, error, refetch } = useHouseholdSummary(householdId);
  const { data: budgets } = useBudgets(householdId, currentMonth);

  useEffect(() => {
    if (!user) return;

    // Fetch user's household membership
    supabase
      .from('membership')
      .select('household_id')
      .eq('user_id', user.id)
      .single()
      .then(({ data, error }) => {
        if (data) {
          setHouseholdId(data.household_id);
        } else if (error) {
          // No household found, redirect to onboarding
          router.replace('/(auth)/onboarding');
        }
      });
  }, [user]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return '#FF3B30';
    if (percentage >= 80) return '#FF9500';
    return '#34C759';
  };

  if (!householdId || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load household data</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={() => refetch()} />
      }
    >
      {/* Household Header */}
      <View style={styles.header}>
        <Text style={styles.householdName}>{summary?.household.name}</Text>
        <Text style={styles.monthLabel}>{summary?.month}</Text>
      </View>

      {/* Balance Cards */}
      <View style={styles.balanceSection}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>You Owe</Text>
          <Text style={[styles.balanceAmount, styles.balanceNegative]}>
            {formatCurrency(summary?.summary.youOwe || 0)}
          </Text>
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Owed to You</Text>
          <Text style={[styles.balanceAmount, styles.balancePositive]}>
            {formatCurrency(summary?.summary.owedToYou || 0)}
          </Text>
        </View>
      </View>

      <View style={styles.netBalanceCard}>
        <Text style={styles.netBalanceLabel}>Net Balance</Text>
        <Text
          style={[
            styles.netBalanceAmount,
            (summary?.summary.netBalance || 0) >= 0
              ? styles.balancePositive
              : styles.balanceNegative,
          ]}
        >
          {formatCurrency(summary?.summary.netBalance || 0)}
        </Text>
        {Math.abs(summary?.summary.netBalance || 0) > 0 && (
          <TouchableOpacity
            style={styles.settleUpButton}
            onPress={() => router.push('/(app)/settlements')}
          >
            <Ionicons name="swap-horizontal" size={18} color="#fff" />
            <Text style={styles.settleUpButtonText}>Settle Up</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Spending Summary */}
      <View style={styles.spendingSection}>
        <Text style={styles.sectionTitle}>This Month</Text>

        <View style={styles.spendingRow}>
          <Text style={styles.spendingLabel}>Shared Spending</Text>
          <Text style={styles.spendingAmount}>
            {formatCurrency(summary?.summary.sharedSpent || 0)}
          </Text>
        </View>

        <View style={styles.spendingRow}>
          <Text style={styles.spendingLabel}>Personal Spending</Text>
          <Text style={styles.spendingAmount}>
            {formatCurrency(summary?.summary.personalSpent || 0)}
          </Text>
        </View>

        <View style={[styles.spendingRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>
            {formatCurrency(summary?.summary.totalSpent || 0)}
          </Text>
        </View>
      </View>

      {/* Recent Transactions */}
      <View style={styles.transactionsSection}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        {summary?.transactions && summary.transactions.length > 0 ? (
          summary.transactions.slice(0, 5).map((tx: any) => (
            <View key={tx.id} style={styles.transactionRow}>
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionMerchant}>{tx.merchant_norm}</Text>
                <Text style={styles.transactionDate}>
                  {new Date(tx.posted_at).toLocaleDateString()}
                </Text>
              </View>
              <Text
                style={[
                  styles.transactionAmount,
                  tx.amount < 0 ? styles.expenseAmount : styles.incomeAmount,
                ]}
              >
                {formatCurrency(Math.abs(tx.amount))}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No recent transactions</Text>
        )}

        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={() => router.push('/(app)/transactions')}
        >
          <Text style={styles.viewAllText}>View All Transactions</Text>
        </TouchableOpacity>
      </View>

      {/* Budgets */}
      {budgets && budgets.length > 0 && (
        <View style={styles.budgetsSection}>
          <View style={styles.budgetsSectionHeader}>
            <Text style={styles.sectionTitle}>Budget Progress</Text>
            {budgets.some((b: any) => (b.percentage || 0) >= 80) && (
              <View style={styles.alertBadge}>
                <Ionicons
                  name={budgets.some((b: any) => (b.percentage || 0) >= 100) ? "warning" : "alert-circle"}
                  size={16}
                  color="#fff"
                />
              </View>
            )}
          </View>

          {/* Overall Budget Alert */}
          {budgets.some((b: any) => (b.percentage || 0) >= 100) && (
            <View style={styles.overallAlert}>
              <Ionicons name="warning" size={20} color="#FF3B30" />
              <View style={styles.overallAlertContent}>
                <Text style={styles.overallAlertTitle}>Budget Alert</Text>
                <Text style={styles.overallAlertText}>
                  {budgets.filter((b: any) => (b.percentage || 0) >= 100).length} {budgets.filter((b: any) => (b.percentage || 0) >= 100).length === 1 ? 'budget has' : 'budgets have'} exceeded the limit
                </Text>
              </View>
            </View>
          )}
          {budgets.some((b: any) => (b.percentage || 0) >= 80 && (b.percentage || 0) < 100) && !budgets.some((b: any) => (b.percentage || 0) >= 100) && (
            <View style={[styles.overallAlert, styles.overallWarning]}>
              <Ionicons name="alert-circle" size={20} color="#FF9500" />
              <View style={styles.overallAlertContent}>
                <Text style={[styles.overallAlertTitle, styles.overallWarningTitle]}>Budget Warning</Text>
                <Text style={[styles.overallAlertText, styles.overallWarningText]}>
                  {budgets.filter((b: any) => (b.percentage || 0) >= 80 && (b.percentage || 0) < 100).length} {budgets.filter((b: any) => (b.percentage || 0) >= 80 && (b.percentage || 0) < 100).length === 1 ? 'budget is' : 'budgets are'} approaching the limit
                </Text>
              </View>
            </View>
          )}

          {budgets.slice(0, 3).map((budget: any) => {
            const percentage = budget.percentage || 0;
            const progressColor = getProgressColor(percentage);

            return (
              <View key={budget.id} style={styles.budgetCard}>
                <View style={styles.budgetHeader}>
                  <Text style={styles.budgetCategory}>{budget.category?.name || 'Unknown'}</Text>
                  <Text style={styles.budgetLimit}>{formatCurrency(budget.amount_limit)}</Text>
                </View>

                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(percentage, 100)}%`,
                        backgroundColor: progressColor,
                      },
                    ]}
                  />
                </View>

                <View style={styles.budgetFooter}>
                  <Text style={styles.budgetSpent}>
                    Spent: {formatCurrency(budget.spent || 0)}
                  </Text>
                  <Text style={[styles.budgetPercentage, { color: progressColor }]}>
                    {percentage.toFixed(0)}%
                  </Text>
                </View>

                {percentage >= 100 && (
                  <View style={styles.budgetAlert}>
                    <Ionicons name="warning" size={14} color="#FF3B30" />
                    <Text style={styles.budgetAlertText}>Over budget!</Text>
                  </View>
                )}
                {percentage >= 80 && percentage < 100 && (
                  <View style={[styles.budgetAlert, styles.budgetWarning]}>
                    <Ionicons name="alert-circle" size={14} color="#FF9500" />
                    <Text style={[styles.budgetAlertText, styles.budgetWarningText]}>
                      Approaching limit
                    </Text>
                  </View>
                )}
              </View>
            );
          })}

          {budgets.length > 3 && (
            <Text style={styles.moreBudgetsText}>
              +{budgets.length - 3} more {budgets.length - 3 === 1 ? 'budget' : 'budgets'}
            </Text>
          )}

          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={() => router.push('/(app)/budgets')}
          >
            <Text style={styles.viewAllText}>View All Budgets</Text>
          </TouchableOpacity>
        </View>
      )}
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
    backgroundColor: '#f5f5f5',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f5f5f5',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  householdName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  monthLabel: {
    fontSize: 14,
    color: '#666',
  },
  balanceSection: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  balanceCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  balanceLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  balancePositive: {
    color: '#34C759',
  },
  balanceNegative: {
    color: '#FF3B30',
  },
  netBalanceCard: {
    backgroundColor: '#007AFF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  netBalanceLabel: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 8,
  },
  netBalanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  settleUpButton: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  settleUpButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  spendingSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  spendingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  spendingLabel: {
    fontSize: 16,
    color: '#333',
  },
  spendingAmount: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  totalRow: {
    borderBottomWidth: 0,
    paddingTop: 16,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  transactionsSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionMerchant: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: '#666',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  expenseAmount: {
    color: '#FF3B30',
  },
  incomeAmount: {
    color: '#34C759',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
  viewAllButton: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  viewAllText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  budgetsSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
  },
  budgetsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  alertBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overallAlert: {
    flexDirection: 'row',
    backgroundColor: '#FFE5E5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 12,
  },
  overallWarning: {
    backgroundColor: '#FFF3E0',
  },
  overallAlertContent: {
    flex: 1,
  },
  overallAlertTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
    marginBottom: 2,
  },
  overallWarningTitle: {
    color: '#FF9500',
  },
  overallAlertText: {
    fontSize: 13,
    color: '#FF3B30',
  },
  overallWarningText: {
    color: '#FF9500',
  },
  budgetCard: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  budgetCategory: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  budgetLimit: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  budgetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetSpent: {
    fontSize: 13,
    color: '#666',
  },
  budgetPercentage: {
    fontSize: 13,
    fontWeight: '600',
  },
  budgetAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
    gap: 6,
  },
  budgetWarning: {
    backgroundColor: '#FFF3E0',
  },
  budgetAlertText: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '500',
  },
  budgetWarningText: {
    color: '#FF9500',
  },
  moreBudgetsText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    marginBottom: 8,
  },
});
