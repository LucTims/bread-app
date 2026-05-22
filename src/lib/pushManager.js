import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/**
 * Convert a base64 URL string to a Uint8Array (for applicationServerKey)
 */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Detect the user's platform
 */
function detectPlatform() {
    const ua = navigator.userAgent.toLowerCase();
    const isTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;

    if (ua.includes('iphone') || ua.includes('ipod') || ua.includes('ipad')) return 'iOS';
    if (ua.includes('macintosh') && isTouch) return 'iOS';
    if (ua.includes('android')) return 'Android';
    if (ua.includes('windows phone')) return 'Android';
    if (ua.includes('windows')) return 'Windows';
    if (ua.includes('macintosh') || ua.includes('mac os')) return 'Mac';
    if (ua.includes('linux')) return 'Linux';
    return 'Autre';
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY;
}

/**
 * Get the current push permission state
 */
export function getPushPermission() {
    if (!isPushSupported()) return 'unsupported';
    return Notification.permission; // 'default', 'granted', 'denied'
}

/**
 * Subscribe the user to push notifications and save subscription to Supabase
 */
export async function subscribeToPush(userId) {
    if (!isPushSupported() || !userId) return null;

    try {
        const registration = await navigator.serviceWorker.ready;

        // Check existing subscription
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            // Request permission & subscribe
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });
        }

        const subJSON = subscription.toJSON();

        // Save to Supabase (upsert on user_id + endpoint)
        const { error } = await supabase
            .from('push_subscriptions')
            .upsert({
                user_id: userId,
                endpoint: subJSON.endpoint,
                keys_p256dh: subJSON.keys.p256dh,
                keys_auth: subJSON.keys.auth,
                platform: detectPlatform(),
            }, {
                onConflict: 'user_id,endpoint'
            });

        if (error) {
            console.error('[Push] Save subscription error:', error);
            return null;
        }

        console.log('[Push] Subscribed successfully');
        return subscription;
    } catch (err) {
        console.error('[Push] Subscribe error:', err);
        return null;
    }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(userId) {
    if (!isPushSupported() || !userId) return;

    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            const endpoint = subscription.endpoint;
            await subscription.unsubscribe();

            // Remove from Supabase
            await supabase
                .from('push_subscriptions')
                .delete()
                .eq('user_id', userId)
                .eq('endpoint', endpoint);

            console.log('[Push] Unsubscribed successfully');
        }
    } catch (err) {
        console.error('[Push] Unsubscribe error:', err);
    }
}

/**
 * Check if user is currently subscribed to push
 */
export async function isSubscribedToPush() {
    if (!isPushSupported()) return false;
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        return !!subscription;
    } catch {
        return false;
    }
}
