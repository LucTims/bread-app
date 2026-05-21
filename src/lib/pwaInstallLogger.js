import { supabase } from './supabase';

export async function logAppInstall(userId, email) {
    if (!userId) return;

    // Detect platform
    let platform = 'Autre';
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
        platform = 'iOS';
    } else if (ua.includes('android')) {
        platform = 'Android';
    } else if (ua.includes('windows')) {
        platform = 'Windows';
    } else if (ua.includes('macintosh') || ua.includes('mac os') || ua.includes('mac os x')) {
        platform = 'Mac';
    } else if (ua.includes('linux')) {
        platform = 'Linux';
    }

    try {
        // Check if already registered for this user and platform to avoid duplicate logs
        const { data, error } = await supabase
            .from('pwa_installs')
            .select('id')
            .eq('user_id', userId)
            .eq('platform', platform)
            .limit(1);

        if (error) {
            console.error('[PWA Install Log] Check error:', error);
            return;
        }

        if (!data || data.length === 0) {
            const { error: insertErr } = await supabase
                .from('pwa_installs')
                .insert({
                    user_id: userId,
                    email: email,
                    platform: platform,
                    installed_at: new Date().toISOString()
                });

            if (insertErr) {
                console.error('[PWA Install Log] Insert error:', insertErr);
            } else {
                console.log(`[PWA Install Log] Recorded install on ${platform} for ${email}`);
            }
        }
    } catch (err) {
        console.error('[PWA Install Log] Exception:', err);
    }
}
