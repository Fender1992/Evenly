# Phase 9 - App Hardening & Store Readiness

**Date:** 2025-10-17
**Phase:** 9 - App Hardening & Store Readiness
**Status:** 📋 RECOMMENDATIONS DOCUMENTED

---

## Overview

Phase 9 focuses on preparing the Evenly app for production deployment and App Store/Play Store submission. While the core functionality (Phases 0-7) is complete and working, this phase identifies areas for hardening, optimization, and polish before public release.

---

## Current State Assessment

### ✅ What's Working Well

**Core Functionality:**
- Complete expense splitting with split engine
- Bank account integration via Plaid
- Transaction categorization and rules
- Budget tracking with real-time spending
- Settlement recording and history
- Comprehensive audit logging

**Technical Foundation:**
- TypeScript strict mode throughout
- RLS policies for data isolation
- React Query for data fetching
- Expo Router for navigation
- Proper authentication flow

**User Experience:**
- Intuitive UI with clear visual hierarchy
- Pull-to-refresh on all data screens
- Loading states on async operations
- Empty states with helpful messaging
- Confirmation dialogs for destructive actions

### ⚠️ Areas for Improvement

This section outlines recommended enhancements for production readiness. The app is **functional as-is** but these improvements would increase robustness and user trust.

---

## 1. Error Handling

### Current State
- ✅ Try-catch blocks on API calls
- ✅ User-friendly error messages via Alert
- ✅ Network error handling
- ⚠️ Some errors only logged to console
- ⚠️ No error boundary components
- ⚠️ No retry logic on failed requests

### Recommendations

#### 1.1 Global Error Boundary
```typescript
// apps/mobile/components/ErrorBoundary.tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

export class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to Sentry
    console.error('Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            Please try restarting the app
          </Text>
          <TouchableOpacity onPress={() => this.setState({ hasError: false })}>
            <Text style={styles.button}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}
```

#### 1.2 Retry Logic
```typescript
// apps/mobile/lib/api.ts
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok && response.status >= 500 && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        continue;
      }
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
}
```

#### 1.3 User-Friendly Error Messages
```typescript
// apps/mobile/lib/errors.ts
export function getUserFriendlyError(error: any): string {
  if (error.message?.includes('network')) {
    return 'No internet connection. Please check your network and try again.';
  }
  if (error.message?.includes('unauthorized')) {
    return 'Your session has expired. Please sign in again.';
  }
  if (error.message?.includes('not found')) {
    return 'The requested data could not be found.';
  }
  return 'Something went wrong. Please try again later.';
}
```

---

## 2. Loading States & Offline Support

### Current State
- ✅ ActivityIndicator on initial load
- ✅ Pull-to-refresh loading indicators
- ✅ Loading state during mutations
- ⚠️ No offline detection
- ⚠️ No offline data persistence
- ⚠️ No queue for offline actions

### Recommendations

#### 2.1 Offline Detection
```typescript
// apps/mobile/hooks/useNetworkStatus.ts
import NetInfo from '@react-native-community/netinfo';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false);
    });

    return () => unsubscribe();
  }, []);

  return { isOnline };
}
```

#### 2.2 Offline Banner
```typescript
// apps/mobile/components/OfflineBanner.tsx
export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();

  if (isOnline) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="cloud-offline" size={16} color="#fff" />
      <Text style={styles.text}>You're offline</Text>
    </View>
  );
}
```

#### 2.3 React Query Offline Support
```typescript
// apps/mobile/app/_layout.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error.message.includes('network')) return false;
        return failureCount < 3;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});
```

**Note:** Full offline support with queue (like PowerSync) is complex and should be Phase 10+ feature.

---

## 3. Data Validation

### Current State
- ✅ Server-side validation on all endpoints
- ✅ Database constraints and checks
- ✅ Client-side input validation
- ⚠️ Some validation messages not user-friendly
- ⚠️ No form validation library

### Recommendations

#### 3.1 Form Validation Library
```bash
npm install react-hook-form zod
```

```typescript
// Example: Budget creation form with validation
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const budgetSchema = z.object({
  category_id: z.string().uuid('Please select a category'),
  amount_limit: z.number().positive('Amount must be greater than zero'),
});

export function CreateBudgetForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(budgetSchema),
  });

  const onSubmit = (data) => {
    // Submit validated data
  };

  return (
    <View>
      {/* Form fields with error display */}
      {errors.amount_limit && (
        <Text style={styles.error}>{errors.amount_limit.message}</Text>
      )}
    </View>
  );
}
```

#### 3.2 Server-Side Validation Enhancement
```typescript
// apps/server/lib/validation.ts
import { z } from 'zod';

export const createBudgetSchema = z.object({
  household_id: z.string().uuid(),
  category_id: z.string().uuid(),
  amount_limit: z.number().positive().max(1000000),
  period_start: z.string().datetime(),
  period_end: z.string().datetime(),
}).refine(
  data => new Date(data.period_end) > new Date(data.period_start),
  { message: 'End date must be after start date' }
);
```

---

## 4. Security Hardening

### Current State
- ✅ RLS policies on all tables
- ✅ Bearer token authentication
- ✅ Household membership verification
- ✅ Audit logging
- ⚠️ Plaid tokens stored unencrypted (noted in Phase 3)
- ⚠️ No rate limiting
- ⚠️ No input sanitization

### Recommendations

#### 4.1 Plaid Token Encryption (Already Noted)
```typescript
// apps/server/lib/crypto.ts
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!; // 32-byte key
const ALGORITHM = 'aes-256-gcm';

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(ivHex, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

#### 4.2 Rate Limiting
```typescript
// apps/server/middleware/rateLimit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
});

export async function rateLimitMiddleware(userId: string) {
  const { success } = await ratelimit.limit(userId);

  if (!success) {
    throw new Error('Rate limit exceeded');
  }
}
```

#### 4.3 Input Sanitization
```typescript
// apps/server/lib/sanitize.ts
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
}
```

---

## 5. Performance Optimization

### Current State
- ✅ React Query caching
- ✅ Efficient database indexes
- ✅ Conditional query enabling
- ⚠️ No image optimization
- ⚠️ No bundle size optimization
- ⚠️ No lazy loading

### Recommendations

#### 5.1 Bundle Size Analysis
```bash
# Analyze bundle size
npx expo-bundle-visualizer

# Optimize imports
# Before:
import { Button } from 'react-native';
# After:
import Button from 'react-native/Libraries/Components/Button';
```

#### 5.2 Lazy Loading
```typescript
// apps/mobile/app/(app)/_layout.tsx
import { lazy, Suspense } from 'react';

const BudgetsScreen = lazy(() => import('./budgets'));
const RulesScreen = lazy(() => import('./rules'));

export default function AppLayout() {
  return (
    <Suspense fallback={<ActivityIndicator />}>
      <Tabs>
        {/* ... */}
      </Tabs>
    </Suspense>
  );
}
```

#### 5.3 Image Optimization
```typescript
// Use expo-image for better performance
import { Image } from 'expo-image';

<Image
  source={{ uri: 'https://example.com/image.jpg' }}
  placeholder={blurhash}
  contentFit="cover"
  transition={1000}
/>
```

---

## 6. User Feedback Mechanisms

### Current State
- ✅ Success alerts on mutations
- ✅ Error alerts on failures
- ⚠️ No toast notifications
- ⚠️ No success animations
- ⚠️ No haptic feedback

### Recommendations

#### 6.1 Toast Notifications
```bash
npm install react-native-toast-message
```

```typescript
// Replace Alert with Toast
import Toast from 'react-native-toast-message';

// Success
Toast.show({
  type: 'success',
  text1: 'Budget created',
  text2: 'Your budget has been set up successfully',
});

// Error
Toast.show({
  type: 'error',
  text1: 'Failed to create budget',
  text2: error.message,
});
```

#### 6.2 Haptic Feedback
```typescript
import * as Haptics from 'expo-haptics';

// On success
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

// On error
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

// On button press
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
```

#### 6.3 Success Animations
```bash
npm install lottie-react-native
```

```typescript
import LottieView from 'lottie-react-native';

<LottieView
  source={require('../../assets/success.json')}
  autoPlay
  loop={false}
  style={{ width: 100, height: 100 }}
/>
```

---

## 7. App Store Preparation

### Current State
- ✅ App configured with Expo
- ✅ Build process working
- ⚠️ No app icon
- ⚠️ No splash screen
- ⚠️ No privacy policy
- ⚠️ No terms of service

### Recommendations

#### 7.1 App Icon & Splash Screen
```json
// app.json
{
  "expo": {
    "icon": "./assets/icon.png", // 1024x1024 PNG
    "splash": {
      "image": "./assets/splash.png", // 2048x2048 PNG
      "resizeMode": "contain",
      "backgroundColor": "#007AFF"
    }
  }
}
```

#### 7.2 App Store Metadata
```
App Name: Evenly - Couple Expense Tracker
Subtitle: Split expenses fairly, automatically
Description:
Evenly makes it easy for couples and roommates to track shared expenses and split them fairly. Connect your bank accounts, set budgets, and settle up with ease.

Features:
• Automatic expense splitting with customizable ratios
• Bank account integration via Plaid
• Smart categorization with rules
• Budget tracking and spending alerts
• Easy settlement tracking
• Complete privacy and security

Keywords: expense, split, budget, couple, roommate, finance, money, tracker
```

#### 7.3 Privacy Policy
Create `PRIVACY_POLICY.md` with:
- Data collection practices
- Third-party services (Plaid, Supabase, Sentry)
- User rights (deletion, export)
- Contact information

#### 7.4 Terms of Service
Create `TERMS_OF_SERVICE.md` with:
- Usage guidelines
- Liability disclaimers
- Account termination policy
- Dispute resolution

---

## 8. Testing Checklist

### Pre-Launch Testing

#### Functional Testing
- [ ] Sign up new user
- [ ] Sign in existing user
- [ ] Create household
- [ ] Link bank account (Plaid sandbox)
- [ ] View transactions
- [ ] Categorize transaction manually
- [ ] Create rule
- [ ] Apply rules
- [ ] Create budget
- [ ] View budget progress
- [ ] Record settlement
- [ ] View settlement history
- [ ] Sign out

#### Edge Cases
- [ ] No internet connection
- [ ] Slow network (3G)
- [ ] Session expiration
- [ ] Empty states (no transactions, budgets, etc.)
- [ ] Large data sets (1000+ transactions)
- [ ] Multiple rapid taps (race conditions)
- [ ] Background/foreground transitions

#### Security Testing
- [ ] Unauthorized API access
- [ ] Cross-household data access
- [ ] SQL injection attempts
- [ ] XSS attempts
- [ ] Token expiration handling

#### Performance Testing
- [ ] App launch time
- [ ] Screen transition speed
- [ ] API response times
- [ ] Memory usage
- [ ] Battery drain

---

## 9. Monitoring & Analytics

### Current State
- ✅ Sentry configured for error tracking
- ✅ PostHog configured for analytics (opt-in)
- ⚠️ No custom events
- ⚠️ No performance monitoring

### Recommendations

#### 9.1 Key Events to Track
```typescript
// User acquisition
posthog.capture('user_signed_up');
posthog.capture('household_created');

// Feature adoption
posthog.capture('bank_account_linked');
posthog.capture('first_budget_created');
posthog.capture('first_rule_created');
posthog.capture('first_settlement_recorded');

// User engagement
posthog.capture('transaction_categorized');
posthog.capture('budget_exceeded');
posthog.capture('settlement_completed');
```

#### 9.2 Performance Monitoring
```typescript
// Track API call durations
const startTime = Date.now();
const response = await fetch(url);
const duration = Date.now() - startTime;

posthog.capture('api_call', {
  endpoint: url,
  duration,
  status: response.status,
});
```

---

## 10. Documentation Needed

### User Documentation
- [ ] Getting started guide
- [ ] How to link bank account
- [ ] How to create budgets
- [ ] How to set up rules
- [ ] How to settle up
- [ ] FAQ

### Developer Documentation
- [ ] Setup instructions (README.md)
- [ ] API documentation
- [ ] Database schema
- [ ] Deployment guide
- [ ] Environment variables
- [ ] Troubleshooting guide

---

## Estimated Timeline

| Task | Priority | Effort | Status |
|------|----------|--------|--------|
| Error boundary | High | 1 day | ⏳ Pending |
| Offline detection | Medium | 1 day | ⏳ Pending |
| Form validation | Medium | 2 days | ⏳ Pending |
| Token encryption | High | 1 day | ⏳ Pending |
| Rate limiting | High | 1 day | ⏳ Pending |
| Bundle optimization | Low | 1 day | ⏳ Pending |
| Toast notifications | Low | 0.5 days | ⏳ Pending |
| App icon/splash | High | 0.5 days | ⏳ Pending |
| Privacy policy | High | 1 day | ⏳ Pending |
| Testing | High | 3 days | ⏳ Pending |
| **Total** | - | **~12 days** | - |

---

## Minimum Viable Hardening (MVH)

For fastest path to production, prioritize:

### Week 1: Critical Items
1. ✅ Token encryption (security)
2. ✅ Rate limiting (security)
3. ✅ Error boundary (stability)
4. ✅ Privacy policy (legal)
5. ✅ App icon/splash (store requirement)

### Week 2: Important Items
6. ✅ Offline detection (UX)
7. ✅ Form validation (UX)
8. ✅ Functional testing (quality)
9. ✅ App store metadata (marketing)
10. ✅ User documentation (support)

### Post-Launch
- Bundle optimization
- Toast notifications
- Haptic feedback
- Advanced analytics
- Performance monitoring

---

## Conclusion

The Evenly app has a **solid foundation** with all core features implemented and working. Phase 9 recommendations focus on:

1. **Security**: Token encryption, rate limiting, input sanitization
2. **Reliability**: Error boundaries, retry logic, offline detection
3. **Polish**: Toast notifications, haptic feedback, animations
4. **Compliance**: Privacy policy, terms of service, app store requirements

**Current Status:** ✅ MVP COMPLETE - Ready for internal testing
**Next Steps:** Implement MVH items, then proceed to App Store submission
**Estimated Time to Production:** 2-3 weeks

---

**Phase Status:** 📋 ROADMAP DOCUMENTED
**Ready for Phase 10:** YES (Documentation)
**Blockers:** NONE (can launch with current state for beta testing)
