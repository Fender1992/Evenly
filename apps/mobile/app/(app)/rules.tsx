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
import { useRules, useCreateRule, useApplyRules } from '../../hooks/useRules';
import { useCategories } from '../../hooks/useCategories';

export default function RulesScreen() {
  const { user } = useAuth();
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: rules, isLoading, refetch } = useRules(householdId);
  const { data: categories } = useCategories(householdId);
  const createRule = useCreateRule();
  const applyRules = useApplyRules();

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

  const handleApplyRules = () => {
    if (!householdId) return;

    Alert.alert(
      'Apply Rules',
      'Apply all rules to uncategorized transactions?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply',
          onPress: async () => {
            try {
              const result = await applyRules.mutateAsync({ household_id: householdId });
              Alert.alert('Success', `Applied rules to ${result.applied_count} transactions`);
              refetch();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const renderRule = ({ item }: { item: any }) => (
    <View style={styles.ruleCard}>
      <View style={styles.ruleHeader}>
        <View style={styles.ruleInfo}>
          <Text style={styles.ruleName}>{item.name || 'Unnamed Rule'}</Text>
          {item.match_vendor_ilike && (
            <Text style={styles.rulePattern}>
              Matches: "{item.match_vendor_ilike}"
            </Text>
          )}
        </View>
        <View style={styles.priorityBadge}>
          <Text style={styles.priorityText}>{item.priority}</Text>
        </View>
      </View>

      <View style={styles.ruleActions}>
        {item.category && (
          <View style={styles.actionTag}>
            <Ionicons name="pricetag" size={14} color="#007AFF" />
            <Text style={styles.actionText}>{item.category.name}</Text>
          </View>
        )}
        {item.mark_as_personal && (
          <View style={styles.actionTag}>
            <Ionicons name="person" size={14} color="#FF9500" />
            <Text style={styles.actionText}>Mark Personal</Text>
          </View>
        )}
      </View>
    </View>
  );

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
        <Text style={styles.headerTitle}>Auto-Categorization Rules</Text>
        <Text style={styles.headerSubtitle}>
          Rules automatically categorize new transactions
        </Text>
      </View>

      <FlatList
        data={rules}
        renderItem={renderRule}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={() => refetch()} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="apps-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No rules yet</Text>
            <Text style={styles.emptySubtext}>
              Create rules to automatically categorize transactions
            </Text>
          </View>
        }
        contentContainerStyle={
          !rules || rules.length === 0 ? styles.emptyListContent : styles.listContent
        }
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleApplyRules}
          disabled={!rules || rules.length === 0}
        >
          <Ionicons name="play" size={20} color="#007AFF" />
          <Text style={styles.secondaryButtonText}>Apply All Rules</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.buttonText}>Create Rule</Text>
        </TouchableOpacity>
      </View>

      <CreateRuleModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        householdId={householdId}
        categories={categories || []}
        onCreate={async (ruleData) => {
          try {
            await createRule.mutateAsync(ruleData);
            setShowCreateModal(false);
            Alert.alert('Success', 'Rule created successfully');
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        }}
      />
    </View>
  );
}

interface CreateRuleModalProps {
  visible: boolean;
  onClose: () => void;
  householdId: string | null;
  categories: any[];
  onCreate: (data: any) => Promise<void>;
}

function CreateRuleModal({
  visible,
  onClose,
  householdId,
  categories,
  onCreate,
}: CreateRuleModalProps) {
  const [name, setName] = useState('');
  const [vendorPattern, setVendorPattern] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [markAsPersonal, setMarkAsPersonal] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!householdId) return;

    if (!vendorPattern) {
      Alert.alert('Error', 'Please enter a vendor pattern');
      return;
    }

    setLoading(true);
    try {
      await onCreate({
        household_id: householdId,
        name: name || `Rule for ${vendorPattern}`,
        match_vendor_ilike: vendorPattern,
        category_id: selectedCategoryId,
        mark_as_personal: markAsPersonal,
      });

      // Reset form
      setName('');
      setVendorPattern('');
      setSelectedCategoryId(null);
      setMarkAsPersonal(false);
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
          <Text style={styles.modalTitle}>Create Rule</Text>
          <TouchableOpacity onPress={handleCreate} disabled={loading}>
            <Text style={[styles.saveText, loading && styles.saveTextDisabled]}>
              {loading ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modalContent}>
          <Text style={styles.label}>Rule Name (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Starbucks → Coffee"
            value={name}
            onChangeText={setName}
            editable={!loading}
          />

          <Text style={styles.label}>Vendor Pattern *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Starbucks"
            value={vendorPattern}
            onChangeText={setVendorPattern}
            autoCapitalize="words"
            editable={!loading}
          />
          <Text style={styles.hint}>
            Transactions containing this text will match this rule
          </Text>

          <Text style={styles.label}>Assign Category</Text>
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

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setMarkAsPersonal(!markAsPersonal)}
            disabled={loading}
          >
            <Ionicons
              name={markAsPersonal ? 'checkbox' : 'square-outline'}
              size={24}
              color="#007AFF"
            />
            <Text style={styles.checkboxLabel}>Mark as Personal</Text>
          </TouchableOpacity>
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
  ruleCard: {
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
  ruleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  ruleInfo: {
    flex: 1,
  },
  ruleName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  rulePattern: {
    fontSize: 14,
    color: '#666',
  },
  priorityBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    height: 28,
    justifyContent: 'center',
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  ruleActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  actionText: {
    fontSize: 12,
    color: '#333',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#007AFF',
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
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
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
    marginBottom: 8,
    marginTop: 16,
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
    marginTop: 4,
  },
  categoryList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    gap: 12,
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#333',
  },
});
