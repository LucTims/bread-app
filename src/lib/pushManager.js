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
 * Get service worker registration with a timeout to prevent hanging
 */
async function getSwRegistration(timeoutMs = 8000) {
    if (!('serviceWorker' in navigator)) return null;

    return Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Service worker ready timed out')), timeoutMs)
        )
    ]);
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported() {
    if (typeof window === 'undefined') return false;
    return (
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window &&
        !!VAPID_PUBLIC_KEY
    );
}

/**
 * Get the current push permission state
 */
export function getPushPermission() {
    if (!isPushSupported()) return 'unsupported';
    try {
        return Notification.permission; // 'default', 'granted', 'denied'
    } catch {
        return 'unsupported';
    }
}

/**
 * Subscribe the user to push notifications and save subscription to Supabase
 */
export async function subscribeToPush(userId) {
    if (!isPushSupported() || !userId) {
        console.warn('[Push] Not supported or no userId');
        return null;
    }

    try {
        // 1. Request notification permission FIRST (before waiting for SW)
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.warn('[Push] Permission denied:', permission);
            return null;
        }

        // 2. Get SW registration with timeout
        const registration = await getSwRegistration();
        if (!registration) {
            console.error('[Push] No service worker registration');
            return null;
        }

        // 3. Check existing subscription
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            // Create new subscription
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });
        }

        if (!subscription) {
            console.error('[Push] Failed to create subscription');
            return null;
        }

        const subJSON = subscription.toJSON();

        // 4. Save to Supabase (upsert on user_id + endpoint)
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
            // Still return subscription even if Supabase save fails
            // The browser subscription is active regardless
            return subscription;
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
        const registration = await getSwRegistration();
        if (!registration) return;

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
        const registration = await getSwRegistration(5000);
        if (!registration) return false;
        const subscription = await registration.pushManager.getSubscription();
        return !!subscription;
    } catch {
        return false;
    }
}
