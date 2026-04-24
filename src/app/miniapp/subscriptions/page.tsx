"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth-context";
import { createClient } from "@supabase/supabase-js";
import { TIER_INFO, type SubscriptionTier } from "@/lib/stars/paywall";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface Subscription {
  id: string;
  tier: SubscriptionTier;
  status: string;
  start_date: string;
  end_date: string | null;
}

export default function SubscriptionsPage() {
  const { accessToken } = useAuth();
  const [userTier, setUserTier] = useState<SubscriptionTier>("free");
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (accessToken) {
      checkSubscription();
    }
  }, [accessToken]);

  async function checkSubscription() {
    try {
      if (!accessToken) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
        {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        }
      );

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        setError("Please log in to view subscriptions");
        setLoading(false);
        return;
      }

      setUserId(user.id);

      // Get subscription
      const { data: sub, error: subError } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError) {
        console.error("Subscription error:", subError);
      }

      setSubscription(sub);

      // Get profile tier
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("subscription_tier")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("Profile error:", profileError);
      }

      if (profileData) {
        setUserTier(profileData.subscription_tier as SubscriptionTier);
      }
    } catch (err) {
      console.error("Error checking subscription:", err);
      setError("Failed to load subscription data");
    } finally {
      setLoading(false);
    }
  }

  async function subscribe(tier: SubscriptionTier) {
    try {
      if (!userId || !accessToken) {
        setError("Please log in to subscribe");
        return;
      }

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
        {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        }
      );

      // Get user's profile to find telegram_id
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("telegram_id")
        .eq("id", userId)
        .single();

      if (profileError || !profileData?.telegram_id) {
        setError("Telegram ID not found");
        return;
      }

      // Call invoice API
      const response = await fetch("/api/stars/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          tier,
          telegramId: profileData.telegram_id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // In production, this would open Telegram's payment interface
        alert(`Invoice created for ${tier}. Payment integration coming soon.`);
      } else {
        setError(data.error || "Failed to create invoice");
      }
    } catch (err) {
      console.error("Error subscribing:", err);
      setError("Failed to create subscription");
    }
  }

  async function cancelSubscription() {
    if (!confirm("Are you sure you want to cancel your subscription?")) return;

    try {
      if (!userId || !accessToken) {
        setError("Please log in to cancel subscription");
        return;
      }

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
        {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        }
      );

      const { error } = await supabase.rpc("downgrade_subscription", {
        p_user_id: userId,
      });

      if (error) {
        setError(error.message);
        return;
      }

      setSubscription(null);
      setUserTier("free");
    } catch (err) {
      console.error("Error canceling subscription:", err);
      setError("Failed to cancel subscription");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={checkSubscription}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Підписка Stars</h1>
        <p className="text-muted-foreground">Підтримайте розвиток проекту та отримайте додаткові функції</p>
      </div>

      {subscription && (
        <Card>
          <CardHeader>
            <CardTitle>Активна підписка</CardTitle>
            <p className="text-sm text-muted-foreground">Дякуємо за підтримку!</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Тарифний план</span>
              <Badge variant="outline">{TIER_INFO[subscription.tier]?.name || subscription.tier}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Статус</span>
              <Badge>{subscription.status}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Початок</span>
              <span>{new Date(subscription.start_date).toLocaleDateString("uk-UA")}</span>
            </div>
            {subscription.end_date && (
              <div className="flex items-center justify-between">
                <span>Закінчення</span>
                <span>{new Date(subscription.end_date).toLocaleDateString("uk-UA")}</span>
              </div>
            )}
            <Separator />
            <Button variant="destructive" className="w-full" onClick={cancelSubscription}>
              Скасувати підписку
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(TIER_INFO) as SubscriptionTier[]).map((tier) => {
          const info = TIER_INFO[tier];
          const isCurrent = userTier === tier;
          const isPremium = tier !== "free";

          return (
            <Card key={tier} className={isCurrent ? "ring-2 ring-primary" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {info.icon} {info.name}
                </CardTitle>
                {isCurrent && <Badge>Активно</Badge>}
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{info.description}</p>
                
                <div className="space-y-2">
                  {info.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-green-500">✓</span>
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <Separator />

                {isPremium ? (
                  <div className="space-y-2">
                    <div className="text-center text-2xl font-bold">
                      {info.priceStars} ⭐
                    </div>
                    <p className="text-center text-xs text-muted-foreground">~${(info.priceStars / 100).toFixed(2)} USD</p>
                    {!isCurrent && (
                      <Button className="w-full" onClick={() => subscribe(tier)}>
                        Підписатися
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button variant="outline" className="w-full" disabled>
                    Поточний тариф
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="text-center text-sm text-muted-foreground">
        <p>Оплата через Telegram Stars</p>
        <p className="mt-1">Підписка автоматично оновлюється кожні 30 днів</p>
      </div>
    </div>
  );
}
