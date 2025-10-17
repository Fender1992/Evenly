/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

import { useState } from 'react';
import { Alert, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { PlaidLink, LinkSuccess, LinkExit } from 'react-native-plaid-link-sdk';
import { usePlaidLinkToken, usePlaidExchange } from '../hooks/usePlaidLink';

interface PlaidLinkButtonProps {
  householdId: string;
  onSuccess?: () => void;
}

export function PlaidLinkButton({ householdId, onSuccess }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const createLinkToken = usePlaidLinkToken();
  const exchangeToken = usePlaidExchange();

  const handlePress = async () => {
    try {
      const result = await createLinkToken.mutateAsync();
      setLinkToken(result.link_token);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create link token');
    }
  };

  const handleSuccess = async (success: LinkSuccess) => {
    try {
      await exchangeToken.mutateAsync({
        public_token: success.publicToken,
        household_id: householdId,
      });

      Alert.alert('Success', 'Bank account connected successfully!');
      setLinkToken(null);
      onSuccess?.();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to connect bank account');
    }
  };

  const handleExit = (exit: LinkExit) => {
    setLinkToken(null);
    if (exit.error) {
      Alert.alert('Error', exit.error.displayMessage || 'Plaid Link failed');
    }
  };

  if (createLinkToken.isPending) {
    return (
      <TouchableOpacity style={styles.button} disabled>
        <ActivityIndicator color="#fff" />
      </TouchableOpacity>
    );
  }

  return (
    <>
      <TouchableOpacity
        style={styles.button}
        onPress={handlePress}
        disabled={createLinkToken.isPending}
      >
        <Text style={styles.buttonText}>+ Connect Bank Account</Text>
      </TouchableOpacity>

      {linkToken && (
        <PlaidLink
          tokenConfig={{
            token: linkToken,
          }}
          onSuccess={handleSuccess}
          onExit={handleExit}
        >
          {/* PlaidLink renders automatically when token is set */}
        </PlaidLink>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
