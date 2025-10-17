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
import { useSettlements, useCreateSettlement } from '../../hooks/useSettlements';
import { useHouseholdSummary } from '../../hooks/useHouseholdSummary';

export default function SettlementsScreen() {
  const { user } = useAuth();
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [partnerUserId, setPartnerUserId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState<string>('Partner');

  const { data: settlements, isLoading, refetch } = useSettlements(householdId);
  const { data: summary } = useHouseholdSummary(householdId);
  const createSettlement = useCreateSettlement();

  useEffect(() => {
    if (!user) return;

    // Fetch user's household membership and partner info
    supabase
      .from('membership')
      .select('household_id, household:household_id(name)')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setHouseholdId(data.household_id);

          // Get household members (partner)
          supabase
            .from('membership')
            .select('user_id')
            .eq('household_id', data.household_id)
            .neq('user_id', user.id)
            .then(({ data: members }) => {
              if (members && members.length > 0) {
                setPartnerUserId(members[0].user_id);
              } else {
                setPartnerUserId(null);
              }
            });
        }
      });
  }, [user]);

  useEffect(() => {
    if (!settlements || settlements.length === 0 || !user) {
      setPartnerName('Partner');
      return;
    }

    const reference = settlements.find((s) => s.from_user_id === user.id || s.to_user_id === user.id);
    if (!reference) {
      setPartnerName('Partner');
      return;
    }

    const counterparty =
      reference.from_user_id === user.id ? reference.to_user : reference.from_user;

    if (counterparty) {
      const name =
        counterparty.user_metadata?.full_name ||
        counterparty.email?.split('@')[0] ||
        'Partner';
      setPartnerName(name);
    } else {
      setPartnerName('Partner');
    }
  }, [settlements, user]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getUserDisplayName = (userObj: any) => {
    if (!userObj) return 'Unknown';
    return userObj.user_metadata?.full_name || userObj.email?.split('@')[0] || 'User';
  };

  const renderSettlement = ({ item }: { item: any }) => {
    const isFromMe = item.from_user_id === user?.id;
    const fromName = getUserDisplayName(item.from_user);
    const toName = getUserDisplayName(item.to_user);

    return (
      <View style={styles.settlementCard}>
        <View style={styles.settlementHeader}>
          <View style={[styles.settlementIcon, isFromMe ? styles.settlementIconPaid : styles.settlementIconReceived]}>
            <Ionicons
              name={isFromMe ? 'arrow-up' : 'arrow-down'}
              size={20}
              color={isFromMe ? '#FF3B30' : '#34C759'}
            />
          </View>
          <View style={styles.settlementInfo}>
            <Text style={styles.settlementText}>
              {isFromMe ? `You paid ${toName}` : `${fromName} paid you`}
            </Text>
            <Text style={styles.settlementDate}>
              {new Date(item.settled_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
            {item.method && (
              <Text style={styles.settlementMethod}>via {item.method}</Text>
            )}
            {item.note && (
              <Text style={styles.settlementNote}>{item.note}</Text>
            )}
          </View>
          <Text style={[styles.settlementAmount, isFromMe ? styles.amountPaid : styles.amountReceived]}>
            {isFromMe ? '-' : '+'}{formatCurrency(Math.abs(item.amount))}
          </Text>
        </View>
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

  const netBalance = summary?.summary?.netBalance || 0;
  const youOwe = summary?.summary?.youOwe || 0;
  const owedToYou = summary?.summary?.owedToYou || 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settlements</Text>
        <Text style={styles.headerSubtitle}>Track payments between household members</Text>
      </View>

      {/* Net Balance Card */}
      <View style={[
        styles.balanceCard,
        netBalance === 0 ? styles.balanceCardNeutral :
        netBalance > 0 ? styles.balanceCardPositive :
        styles.balanceCardNegative
      ]}>
        <Text style={styles.balanceLabel}>Current Balance</Text>
        <Text style={styles.balanceAmount}>
          {formatCurrency(Math.abs(netBalance))}
        </Text>
        <Text style={styles.balanceDescription}>
          {netBalance === 0 ? 'All settled up!' :
           netBalance > 0 ? `${partnerName} owes you` :
           `You owe ${partnerName}`}
        </Text>

        {netBalance !== 0 && (
          <TouchableOpacity
            style={styles.settleButton}
            onPress={() => setShowRecordModal(true)}
          >
            <Ionicons name="swap-horizontal" size={18} color="#fff" />
            <Text style={styles.settleButtonText}>Record Settlement</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Balance Breakdown */}
      <View style={styles.breakdownSection}>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>You Owe</Text>
          <Text style={[styles.breakdownValue, styles.breakdownNegative]}>
            {formatCurrency(youOwe)}
          </Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Owed to You</Text>
          <Text style={[styles.breakdownValue, styles.breakdownPositive]}>
            {formatCurrency(owedToYou)}
          </Text>
        </View>
      </View>

      {/* Settlement History */}
      <View style={styles.historySection}>
        <Text style={styles.sectionTitle}>Settlement History</Text>
      </View>

      <FlatList
        data={settlements}
        renderItem={renderSettlement}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={() => refetch()} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No settlements yet</Text>
            <Text style={styles.emptySubtext}>
              Record settlements when you pay each other back
            </Text>
          </View>
        }
        contentContainerStyle={
          !settlements || settlements.length === 0 ? styles.emptyListContent : styles.listContent
        }
      />

      <RecordSettlementModal
        visible={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        householdId={householdId}
        partnerUserId={partnerUserId}
        partnerName={partnerName}
        currentBalance={netBalance}
        onCreate={async (settlementData) => {
          try {
            await createSettlement.mutateAsync(settlementData);
            setShowRecordModal(false);
            Alert.alert('Success', 'Settlement recorded successfully');
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        }}
      />
    </View>
  );
}

interface RecordSettlementModalProps {
  visible: boolean;
  onClose: () => void;
  householdId: string | null;
  partnerUserId: string | null;
  partnerName: string;
  currentBalance: number;
  onCreate: (data: any) => Promise<void>;
}

function RecordSettlementModal({
  visible,
  onClose,
  householdId,
  partnerUserId,
  partnerName,
  currentBalance,
  onCreate,
}: RecordSettlementModalProps) {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'venmo' | 'zelle' | 'cashapp' | 'cash' | 'other'>('venmo');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const methods: Array<'venmo' | 'zelle' | 'cashapp' | 'cash' | 'other'> =
    ['venmo', 'zelle', 'cashapp', 'cash', 'other'];

  const handleRecord = async () => {
    if (!householdId || !partnerUserId) return;

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const settlementAmount = parseFloat(amount);

    // Determine direction based on current balance
    // If balance is negative (I owe partner), I am paying them
    // If balance is positive (partner owes me), they are paying me
    const isPayingPartner = currentBalance < 0;

    setLoading(true);
    try {
      await onCreate({
        household_id: householdId,
        to_user_id: isPayingPartner ? partnerUserId : user!.id,
        amount: settlementAmount,
        method,
        note: note.trim() || undefined,
      });

      // Reset form
      setAmount('');
      setNote('');
      setMethod('venmo');
    } finally {
      setLoading(false);
    }
  };

  const isPayingPartner = currentBalance < 0;
  const suggestedAmount = Math.abs(currentBalance);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Record Settlement</Text>
          <TouchableOpacity onPress={handleRecord} disabled={loading}>
            <Text style={[styles.saveText, loading && styles.saveTextDisabled]}>
              {loading ? 'Recording...' : 'Record'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modalContent}>
          <View style={styles.directionInfo}>
            <Ionicons
              name={isPayingPartner ? 'arrow-forward' : 'arrow-back'}
              size={24}
              color="#007AFF"
            />
            <Text style={styles.directionText}>
              {isPayingPartner
                ? `You are paying ${partnerName}`
                : `${partnerName} is paying you`}
            </Text>
          </View>

          <Text style={styles.label}>Amount *</Text>
          <View style={styles.amountInputContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              editable={!loading}
            />
            {suggestedAmount > 0 && (
              <TouchableOpacity
                onPress={() => setAmount(suggestedAmount.toFixed(2))}
                style={styles.suggestButton}
              >
                <Text style={styles.suggestButtonText}>
                  Full: ${suggestedAmount.toFixed(2)}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.label}>Payment Method *</Text>
          <View style={styles.methodList}>
            {methods.map((m) => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.methodChip,
                  method === m && styles.methodChipSelected,
                ]}
                onPress={() => setMethod(m)}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.methodChipText,
                    method === m && styles.methodChipTextSelected,
                  ]}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Note (Optional)</Text>
          <TextInput
            style={styles.noteInput}
            placeholder="Add a note..."
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
            editable={!loading}
          />
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
  balanceCard: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  balanceCardNeutral: {
    backgroundColor: '#F0F0F0',
  },
  balanceCardPositive: {
    backgroundColor: '#E8F5E9',
  },
  balanceCardNegative: {
    backgroundColor: '#FFEBEE',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  balanceDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  settleButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
    gap: 8,
  },
  settleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  breakdownSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#666',
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  breakdownNegative: {
    color: '#FF3B30',
  },
  breakdownPositive: {
    color: '#34C759',
  },
  historySection: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
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
  settlementCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  settlementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settlementIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settlementIconPaid: {
    backgroundColor: '#FFEBEE',
  },
  settlementIconReceived: {
    backgroundColor: '#E8F5E9',
  },
  settlementInfo: {
    flex: 1,
  },
  settlementText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  settlementDate: {
    fontSize: 13,
    color: '#666',
  },
  settlementMethod: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  settlementNote: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  settlementAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  amountPaid: {
    color: '#FF3B30',
  },
  amountReceived: {
    color: '#34C759',
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
    width: 100,
    textAlign: 'right',
  },
  saveTextDisabled: {
    color: '#ccc',
  },
  modalContent: {
    padding: 16,
  },
  directionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
  },
  directionText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 16,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '500',
    color: '#666',
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '500',
    paddingVertical: 12,
  },
  suggestButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  suggestButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  methodList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  methodChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  methodChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  methodChipText: {
    fontSize: 14,
    color: '#333',
  },
  methodChipTextSelected: {
    color: '#fff',
  },
  noteInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
});
