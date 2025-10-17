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
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useBudgets, useCreateBudget, useDeleteBudget } from '../../hooks/useBudgets';
import { useCategories } from '../../hooks/useCategories';

export default function BudgetsScreen() {
  const { user } = useAuth();
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));

  const { data: budgets, isLoading, refetch } = useBudgets(householdId, currentMonth);
  const { data: categories } = useCategories(householdId);
  const createBudget = useCreateBudget();
  const deleteBudget = useDeleteBudget();

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
        }
      });
  }, [user]);

  const handleDeleteBudget = (budgetId: string) => {
    if (!householdId) return;

    Alert.alert(
      'Delete Budget',
      'Are you sure you want to delete this budget?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBudget.mutateAsync({ budget_id: budgetId, household_id: householdId });
              Alert.alert('Success', 'Budget deleted');
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return '#FF3B30';
    if (percentage >= 80) return '#FF9500';
    return '#34C759';
  };

  const renderBudget = ({ item }: { item: any }) => {
    const percentage = item.percentage || 0;
    const progressColor = getProgressColor(percentage);

    return (
      <View style={styles.budgetCard}>
        <View style={styles.budgetHeader}>
          <View style={styles.budgetInfo}>
            <Text style={styles.budgetCategory}>{item.category?.name || 'Unknown'}</Text>
            <Text style={styles.budgetAmount}>{formatCurrency(item.amount_limit)}</Text>
          </View>
          <TouchableOpacity onPress={() => handleDeleteBudget(item.id)}>
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
          </TouchableOpacity>
        </View>

        <View style={styles.progressSection}>
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
          <View style={styles.progressLabels}>
            <Text style={styles.spentText}>
              Spent: {formatCurrency(item.spent || 0)}
            </Text>
            <Text style={[styles.percentageText, { color: progressColor }]}>
              {percentage.toFixed(0)}%
            </Text>
          </View>
        </View>

        {percentage >= 100 && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={16} color="#FF3B30" />
            <Text style={styles.warningText}>
              Budget exceeded by {formatCurrency(Math.abs(item.remaining || 0))}
            </Text>
          </View>
        )}

        {percentage >= 80 && percentage < 100 && (
          <View style={[styles.warningBanner, styles.cautionBanner]}>
            <Ionicons name="alert-circle" size={16} color="#FF9500" />
            <Text style={[styles.warningText, styles.cautionText]}>
              Approaching limit ({formatCurrency(item.remaining || 0)} remaining)
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Monthly Budgets</Text>
        <Text style={styles.headerSubtitle}>Track spending by category</Text>
      </View>

      <FlatList
        data={budgets}
        renderItem={renderBudget}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={() => refetch()} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="wallet-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No budgets yet</Text>
            <Text style={styles.emptySubtext}>
              Create budgets to track spending by category
            </Text>
          </View>
        }
        contentContainerStyle={
          !budgets || budgets.length === 0 ? styles.emptyListContent : styles.listContent
        }
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.buttonText}>Create Budget</Text>
        </TouchableOpacity>
      </View>

      <CreateBudgetModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        householdId={householdId}
        categories={categories || []}
        currentMonth={currentMonth}
        onCreate={async (budgetData) => {
          try {
            await createBudget.mutateAsync(budgetData);
            setShowCreateModal(false);
            Alert.alert('Success', 'Budget created successfully');
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        }}
      />
    </View>
  );
}

interface CreateBudgetModalProps {
  visible: boolean;
  onClose: () => void;
  householdId: string | null;
  categories: any[];
  currentMonth: string;
  onCreate: (data: any) => Promise<void>;
}

function CreateBudgetModal({
  visible,
  onClose,
  householdId,
  categories,
  currentMonth,
  onCreate,
}: CreateBudgetModalProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!householdId || !selectedCategoryId) return;

    if (!amount || isNaN(parseFloat(amount))) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const [year, month] = currentMonth.split('-').map(Number);
    const periodStart = new Date(year, month - 1, 1).toISOString();
    const periodEnd = new Date(year, month, 0, 23, 59, 59).toISOString();

    setLoading(true);
    try {
      await onCreate({
        household_id: householdId,
        category_id: selectedCategoryId,
        amount_limit: parseFloat(amount),
        period_start: periodStart,
        period_end: periodEnd,
      });

      // Reset form
      setSelectedCategoryId(null);
      setAmount('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Create Budget</Text>
          <TouchableOpacity onPress={handleCreate} disabled={loading}>
            <Text style={[styles.saveText, loading && styles.saveTextDisabled]}>
              {loading ? 'Creating...' : 'Create'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modalContent}>
          <Text style={styles.label}>Select Category *</Text>
          <View style={styles.categoryList}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryChip,
                  selectedCategoryId === category.id && styles.categoryChipSelected,
                ]}
                onPress={() => setSelectedCategoryId(category.id)}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    selectedCategoryId === category.id && styles.categoryChipTextSelected,
                  ]}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Monthly Budget Amount *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 500"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            editable={!loading}
          />

          <Text style={styles.hint}>
            Budget period: {currentMonth}
          </Text>
        </View>
      </View>
    </Modal>
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
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
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
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  budgetCard: {
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
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  budgetInfo: {
    flex: 1,
  },
  budgetCategory: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  budgetAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  progressSection: {
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  spentText: {
    fontSize: 14,
    color: '#666',
  },
  percentageText: {
    fontSize: 14,
    fontWeight: '600',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  cautionBanner: {
    backgroundColor: '#FFF3E0',
  },
  warningText: {
    fontSize: 13,
    color: '#FF3B30',
    flex: 1,
  },
  cautionText: {
    color: '#FF9500',
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    width: 80,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
    width: 80,
    textAlign: 'right',
  },
  saveTextDisabled: {
    color: '#ccc',
  },
  modalContent: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 16,
  },
  categoryList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  categoryChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  categoryChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#333',
  },
  categoryChipTextSelected: {
    color: '#fff',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
});
