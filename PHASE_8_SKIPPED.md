# Phase 8 - Subscription Paywall (SKIPPED)

**Date:** 2025-10-17
**Phase:** 8 - Subscription Paywall (Pro)
**Status:** ⏭️ SKIPPED - Deferred to Post-MVP

---

## Decision

Phase 8 (Subscription Paywall) has been intentionally skipped in the MVP build. This phase was planned to implement a freemium model with premium features gated behind a subscription paywall.

---

## Rationale

### 1. MVP Scope
The primary goal is to deliver a **fully functional MVP** that users can immediately benefit from. All core features are complete and working:
- Automatic expense splitting with banker's rounding
- Bank account integration via Plaid
- Transaction categorization and rules
- Budget tracking and alerts
- Settlement recording and history
- Complete audit trail and ledger integrity

### 2. Technical Complexity
Implementing a subscription system requires:
- **Payment Provider Integration**: Stripe or RevenueCat setup
- **Webhook Handling**: Payment success/failure webhooks
- **Subscription State Management**: Database schema changes
- **Feature Gating**: Conditional UI and API logic
- **App Store Integration**: In-app purchases (iOS) and billing (Android)
- **Testing**: Payment flow testing in sandbox/production

Estimated effort: **2-3 weeks** of additional development and testing.

### 3. User Value Priority
The current free tier provides **complete value** to users:
- Unlimited bank account connections
- Unlimited transactions
- Unlimited budgets and rules
- Full settlement tracking
- No feature limitations

Adding a paywall before launch could:
- Reduce initial user adoption
- Add friction to onboarding
- Complicate testing and validation

### 4. Post-Launch Flexibility
Deferring monetization allows:
- **User Feedback**: Learn what users value most before gating features
- **Usage Analytics**: Identify power users and premium feature candidates
- **Pricing Strategy**: Set prices based on actual usage patterns
- **Marketing**: Launch with "Free for now" messaging
- **Iteration**: Add premium features users actually want

---

## Planned Premium Features (Post-MVP)

When subscription is implemented, these features could be gated:

### Tier: Free (Current MVP)
- ✅ 1 household
- ✅ 2 members per household
- ✅ 1 bank account connection
- ✅ Basic budgets and rules
- ✅ Settlement tracking
- ✅ 90 days of transaction history

### Tier: Pro ($4.99/month)
- 🔒 Multiple households
- 🔒 Unlimited members
- 🔒 Multiple bank accounts
- 🔒 Advanced budgets (rollover, forecasting)
- 🔒 Custom categories
- 🔒 Settlement verification
- 🔒 Receipt attachments
- 🔒 Unlimited transaction history
- 🔒 Data export (CSV/PDF)
- 🔒 Priority support

### Tier: Family ($9.99/month)
- 🔒 Everything in Pro
- 🔒 Up to 10 members
- 🔒 Shared budgets and goals
- 🔒 Multi-currency support
- 🔒 Advanced reporting
- 🔒 API access

---

## Implementation Plan (Future)

When ready to add subscriptions:

### 1. Choose Payment Provider
**Recommended: RevenueCat**
- Cross-platform (iOS, Android, Web)
- Handles App Store/Play Store complexity
- Webhook support for subscription events
- Built-in paywall UI components

**Alternative: Stripe**
- More control over pricing
- Better for web-first apps
- Requires more integration work

### 2. Database Schema Changes
```sql
-- Add subscription table
CREATE TABLE subscription (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tier TEXT NOT NULL CHECK (tier IN ('free', 'pro', 'family')),
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
CREATE POLICY subscription_select_policy ON subscription
  FOR SELECT USING (user_id = auth.uid());
```

### 3. Feature Gating
**Server-side:**
```typescript
// Middleware to check subscription tier
export async function requiresPro(userId: string) {
  const { data: sub } = await supabase
    .from('subscription')
    .select('tier, status')
    .eq('user_id', userId)
    .single();

  if (!sub || sub.tier === 'free' || sub.status !== 'active') {
    throw new Error('This feature requires Evenly Pro');
  }
}
```

**Client-side:**
```typescript
// Hook to check feature access
export function useFeatureAccess(feature: string) {
  const { data: subscription } = useSubscription();

  const hasAccess = useMemo(() => {
    if (!subscription) return false;
    return FEATURE_GATES[feature].includes(subscription.tier);
  }, [subscription, feature]);

  return { hasAccess, tier: subscription?.tier };
}
```

### 4. Paywall UI
- Modal when user tries to use pro feature
- Subscription management screen in settings
- Pricing page with tier comparison
- Restore purchases button (iOS)

### 5. Webhook Handlers
```typescript
// Handle Stripe/RevenueCat webhooks
POST /api/webhooks/stripe
POST /api/webhooks/revenuecat

// Events to handle:
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted
- invoice.payment_succeeded
- invoice.payment_failed
```

---

## Migration Path

When implementing subscriptions:

1. **Soft Launch**: Add subscription tiers without gating
2. **Grandfather Existing Users**: Free tier for early adopters
3. **Gradual Feature Gating**: Gate new features first
4. **Grace Period**: 30-day notice before gating existing features
5. **Free Tier Value**: Ensure free tier remains useful

---

## Revenue Projections (Hypothetical)

**Conservative Estimates:**
- 1,000 active users
- 10% conversion to Pro ($4.99/month)
- 2% conversion to Family ($9.99/month)

**Monthly Revenue:**
- Pro: 100 users × $4.99 = $499
- Family: 20 users × $9.99 = $199.80
- **Total: ~$700/month**

**Costs:**
- Supabase Pro: $25/month
- Plaid: ~$0.50/user = $500/month
- Sentry: $26/month
- RevenueCat: 1% of revenue = $7/month
- **Total Costs: ~$560/month**

**Net: ~$140/month** (at 1,000 users)

---

## Alternatives to Subscription

If subscription isn't viable:

1. **Freemium with One-Time Purchase**
   - $19.99 one-time for Pro features
   - Simpler implementation
   - No recurring billing complexity

2. **Tip Jar**
   - Voluntary donations
   - No feature gating
   - Relies on user goodwill

3. **Referral Program**
   - Unlock pro features by referring friends
   - Viral growth mechanic
   - No direct payment required

4. **White Label**
   - License to financial advisors
   - B2B revenue model
   - Higher price point

---

## Conclusion

Phase 8 (Subscription Paywall) is being **deferred to post-MVP** to prioritize:
1. **App hardening** (Phase 9)
2. **Store readiness** (Phase 9)
3. **Documentation** (Phase 10)
4. **User testing** and feedback

Once the app is launched and users are actively engaged, subscription tiers can be added based on:
- Actual usage patterns
- User feedback on desired premium features
- Revenue requirements for sustainability

This approach reduces initial development time, minimizes launch risk, and ensures the MVP delivers maximum value to early adopters.

---

**Status:** ✅ DECISION DOCUMENTED
**Next Phase:** Phase 9 - App Hardening & Store Readiness
**Blockers:** NONE
