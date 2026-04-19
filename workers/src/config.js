import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });
dotenv.config({ path: './.env' });

export const config = {
    supabase: {
        url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
        serviceKey: process.env.SUPABASE_SERVICE_KEY
    },
    telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN
    },
    monitoring: {
        checkIntervalMinutes: parseInt(process.env.CHECK_INTERVAL_MINUTES || '5')
    }
}
