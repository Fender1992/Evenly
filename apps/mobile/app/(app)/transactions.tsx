/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useHouseholdSummary } from '../../hooks/useHouseholdSummary';
import { useCategories } from '../../hooks/useCategories';
import { useUpdateTransaction } from '../../hooks/useTransactions';

interface Transaction {
  id: string;
  merchant_norm: string;
  amount: number;
  posted_at: string;
  is_pending: boolean;
  is_personal: boolean;
  category_id: string | null;
}

export default function TransactionsScreen() {
  const { user } = useAuth();
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const { refetch } = useHouseholdSummary(householdId);
  const { data: categories } = useCategories(householdId);
  const updateTransaction = useUpdateTransaction();

  useEffect(() => {
    if (!user) return;

    // Fetch user's household membership
    supabase
      .from('membership')
      .select('household_id')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setHouseholdId(data.household_id);
          fetchTransactions(data.household_id);
        }
      });
  }, [user]);

  const fetchTransactions = async (hhId: string) => {
    setLoading(true);
    try {
      // Get all accounts for this household
      const { data: accounts } = await supabase
        .from('account')
        .select('id')
        .eq('household_id', hhId);

      if (!accounts) return;

      const accountIds = accounts.map((a) => a.id);

      // Get all transactions
      const { data } = await supabase
        .from('transaction')
        .select('*')
        .in('account_id', accountIds)
        .order('posted_at', { ascending: false })
        .limit(100);

      if (data) {
        setTransactions(data);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (householdId) {
      fetchTransactions(householdId);
      refetch();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handleCategorize = async (categoryId: string | null, isPersonal: boolean) => {
    if (!selectedTransaction || !householdId) return;

    try {
      await updateTransaction.mutateAsync({
        transaction_id: selectedTransaction.id,
        household_id: householdId,
        category_id: categoryId,
        is_personal: isPersonal,
      });

      // Refresh transactions
      fetchTransactions(householdId);
      setSelectedTransaction(null);
      Alert.alert('Success', 'Transaction updated');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <TouchableOpacity
      style={styles.transactionCard}
      onPress={() => setSelectedTransaction(item)}
    >
      <View style={styles.transactionHeader}>
        <Text style={styles.merchant}>{item.merchant_norm}</Text>
        {item.is_pending && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>Pending</Text>
          </View>
        )}
        {item.is_personal && (
          <View style={styles.personalBadge}>
            <Text style={styles.personalText}>Personal</Text>
          </View>
        )}
      </View>
      <View style={styles.transactionDetails}>
        <Text style={styles.date}>
          {new Date(item.posted_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
        <Text
          style={[
            styles.amount,
            item.amount < 0 ? styles.expenseAmount : styles.incomeAmount,
          ]}
        >
          {formatCurrency(item.amount)}
        </Text>
      </View>
      <View style={styles.editIndicator}>
        <Ionicons name="chevron-forward" size={16} color="#999" />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No transactions yet</Text>
            <Text style={styles.emptySubtext}>
              Connect a bank account to see transactions
            </Text>
          </View>
        }
        contentContainerStyle={
          transactions.length === 0 ? styles.emptyListContent : styles.listContent
        }
      />

      {/* Categorization Modal */}
      <Modal
        visible={!!selectedTransaction}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedTransaction(null)}
      >
        {selectedTransaction && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedTransaction(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Categorize</Text>
              <View style={{ width: 60 }} />
            </View>

            <View style={styles.modalContent}>
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionMerchant}>{selectedTransaction.merchant_norm}</Text>
                <Text style={styles.transactionAmount}>
                  {formatCurrency(selectedTransaction.amount)}
                </Text>
              </View>

              <Text style={styles.sectionLabel}>Select Category</Text>
              <View style={styles.categoryGrid}>
                {categories?.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryButton,
                      selectedTransaction.category_id === category.id && styles.categoryButtonSelected,
                    ]}
                    onPress={() => handleCategorize(category.id, false)}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        selectedTransaction.category_id === category.id && styles.categoryButtonTextSelected,
                      ]}
                    >
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.personalButton}
                onPress={() => handleCategorize(null, !selectedTransaction.is_personal)}
              >
                <Ionicons
                  name={selectedTransaction.is_personal ? 'checkbox' : 'square-outline'}
                  size={24}
                  color="#007AFF"
                />
                <Text style={styles.personalButtonText}>Mark as Personal</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>
    </View>
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
  listContent: {
    padding: 16,
  },
  emptyListContent: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  transactionCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  merchant: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  pendingBadge: {
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  pendingText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#856404',
  },
  personalBadge: {
    backgroundColor: '#E0E0E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  personalText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
  },
  transactionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 14,
    color: '#666',
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  expenseAmount: {
    color: '#FF3B30',
  },
  incomeAmount: {
    color: '#34C759',
  },
  editIndicator: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cancelText: {
    fontSize: 16,
    color: '#007AFF',
    width: 60,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalContent: {
    padding: 16,
  },
  transactionInfo: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  transactionMerchant: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  transactionAmount: {
    fontSize: 18,
    color: '#666',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    color: '#666',
    textTransform: 'uppercase',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  categoryButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  categoryButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#333',
  },
  categoryButtonTextSelected: {
    color: '#fff',
  },
  personalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  personalButtonText: {
    fontSize: 16,
    color: '#333',
  },
});
