import TelegramBot from 'node-telegram-bot-api'
import { config } from '../config.js'

/**
 * Enhanced Telegram Notifier
 * 
 * Alert types:
 * - Stop alerts (restaurant closed)
 * - Recovery alerts (restaurant back online)
 * - Product stop alerts (too many products unavailable)
 * - Radius reduction alerts (delivery area reduced)
 * - Rating drop alerts (rating decreased)
 * - Daily reports
 */
export class TelegramNotifier {
    constructor() {
        if (!config.telegram.botToken) {
            console.warn('   [Telegram] Bot token not configured')
            this.bot = null
            return
        }

        this.bot = new TelegramBot(config.telegram.botToken, { polling: false })
    }

    /**
     * Send alert for restaurant stopped
     */
    async sendStopAlert(restaurant, platform, details) {
        if (!this.bot || !restaurant.telegram_group_id) return false

        const message = this.formatStopMessage(restaurant, platform, details)

        const keyboard = {
            inline_keyboard: [
                [
                    { text: 'Marcare Rezolvat', callback_data: `resolve_${restaurant.id}_${platform}` },
                    { text: 'Mute 1h', callback_data: `mute_${restaurant.id}_60` }
                ],
                [
                    { text: 'Dashboard', url: 'http://localhost:5533/monitoring' },
                    { text: `Deschide ${platform}`, url: restaurant[`${platform}_url`] || 'http://localhost:5533' }
                ]
            ]
        }

        try {
            await this.bot.sendMessage(restaurant.telegram_group_id, message, {
                parse_mode: 'HTML',
                reply_markup: keyboard
            })
            console.log(`   [Telegram] Stop alert sent for ${restaurant.name}`)
            return true
        } catch (error) {
            console.error('   [Telegram] Error sending stop alert:', error.message)
            return false
        }
    }

    /**
     * Send alert for restaurant back online
     */
    async sendRecoveryAlert(restaurant, platform, durationMinutes) {
        if (!this.bot || !restaurant.telegram_group_id) return false

        const message = `
<b>Restaurant Revenit Online</b>

<b>Restaurant:</b> ${restaurant.name}
<b>Platforma:</b> ${platform.toUpperCase()}
<b>Oras:</b> ${restaurant.city || 'N/A'}

Problema rezolvata dupa <b>${this.formatDuration(durationMinutes)}</b>

<i>${new Date().toLocaleString('ro-RO')}</i>
    `.trim()

        const keyboard = {
            inline_keyboard: [
                [{ text: 'Dashboard', url: 'http://localhost:5533/monitoring' }]
            ]
        }

        try {
            await this.bot.sendMessage(restaurant.telegram_group_id, message, {
                parse_mode: 'HTML',
                reply_markup: keyboard
            })
            return true
        } catch (error) {
            console.error('   [Telegram] Error sending recovery alert:', error.message)
            return false
        }
    }

    /**
     * Send alert for product stops exceeding threshold
     */
    async sendProductStopAlert(restaurant, platform, stoppedCount, totalCount, stopPercent) {
        if (!this.bot || !restaurant.telegram_group_id) return false

        const severity = stopPercent > 50 ? 'CRITIC' : 'AVERTIZARE'

        const message = `
<b>${severity} - Produse pe STOP</b>

<b>Restaurant:</b> ${restaurant.name}
<b>Platforma:</b> ${platform.toUpperCase()}

<b>${stoppedCount}</b> din <b>${totalCount}</b> produse sunt indisponibile (<b>${stopPercent.toFixed(0)}%</b> din meniu)

${stopPercent > 50 ? 'Mai mult de jumatate din meniu este pe STOP!' : `Procentul depaseste limita configurata.`}

<i>Detectat automat la ${new Date().toLocaleString('ro-RO')}</i>
    `.trim()

        const keyboard = {
            inline_keyboard: [
                [
                    { text: 'Verifica', url: restaurant[`${platform}_url`] || 'http://localhost:5533' },
                    { text: 'Dashboard', url: 'http://localhost:5533/monitoring' }
                ]
            ]
        }

        try {
            await this.bot.sendMessage(restaurant.telegram_group_id, message, {
                parse_mode: 'HTML',
                reply_markup: keyboard
            })
            console.log(`   [Telegram] Product stop alert sent for ${restaurant.name}`)
            return true
        } catch (error) {
            console.error('   [Telegram] Error sending product stop alert:', error.message)
            return false
        }
    }

    /**
     * Send alert for delivery radius reduction
     */
    async sendRadiusAlert(restaurant, platform, normalRadius, currentRadius, estimatedLoss) {
        if (!this.bot || !restaurant.telegram_group_id) return false

        const reductionPercent = ((1 - currentRadius / normalRadius) * 100).toFixed(0)

        const message = `
<b>AVERTIZARE - Raza de Livrare Redusa</b>

<b>Restaurant:</b> ${restaurant.name}
<b>Platforma:</b> ${platform.toUpperCase()}

Raza de livrare a fost redusa:
<b>${normalRadius} km</b> (normal) → <b>${currentRadius} km</b> (actual)
Reducere: <b>${reductionPercent}%</b>

${estimatedLoss ? `<b>Pierdere estimata/ora:</b> ${estimatedLoss.toFixed(2)} RON` : ''}

<i>Detectat automat la ${new Date().toLocaleString('ro-RO')}</i>
    `.trim()

        const keyboard = {
            inline_keyboard: [
                [
                    { text: 'Verifica', url: restaurant[`${platform}_url`] || 'http://localhost:5533' },
                    { text: 'Dashboard', url: 'http://localhost:5533/marketing' }
                ]
            ]
        }

        try {
            await this.bot.sendMessage(restaurant.telegram_group_id, message, {
                parse_mode: 'HTML',
                reply_markup: keyboard
            })
            console.log(`   [Telegram] Radius alert sent for ${restaurant.name}`)
            return true
        } catch (error) {
            console.error('   [Telegram] Error sending radius alert:', error.message)
            return false
        }
    }

    /**
     * Send alert for rating drop
     */
    async sendRatingDropAlert(restaurant, platform, previousRating, currentRating) {
        if (!this.bot || !restaurant.telegram_group_id) return false

        const drop = (previousRating - currentRating).toFixed(1)

        const message = `
<b>AVERTIZARE - Scadere Rating</b>

<b>Restaurant:</b> ${restaurant.name}
<b>Platforma:</b> ${platform.toUpperCase()}

Ratingul a scazut:
<b>${previousRating}</b> → <b>${currentRating}</b> (−${drop})

Recomandam verificarea recenziilor recente.

<i>Detectat automat la ${new Date().toLocaleString('ro-RO')}</i>
    `.trim()

        const keyboard = {
            inline_keyboard: [
                [
                    { text: 'Recenzii', url: restaurant[`${platform}_url`] || 'http://localhost:5533' },
                    { text: 'Marketing', url: 'http://localhost:5533/marketing' }
                ]
            ]
        }

        try {
            await this.bot.sendMessage(restaurant.telegram_group_id, message, {
                parse_mode: 'HTML',
                reply_markup: keyboard
            })
            console.log(`   [Telegram] Rating drop alert sent for ${restaurant.name}`)
            return true
        } catch (error) {
            console.error('   [Telegram] Error sending rating drop alert:', error.message)
            return false
        }
    }

    /**
     * Send daily report
     */
    async sendDailyReport(chatId, stats) {
        if (!this.bot) return false

        const uptimeStatus = stats.uptimePercent > 95 ? 'Excelent' : stats.uptimePercent > 80 ? 'Acceptabil' : 'Critic'

        const message = `
<b>Raport Zilnic - Aggregator Monitor</b>

<b>Uptime General:</b> ${stats.uptimePercent}% (${uptimeStatus})

<b>Restaurante monitorizate:</b> ${stats.totalRestaurants}
<b>Total verificari:</b> ${stats.totalChecks}
<b>Probleme detectate:</b> ${stats.issues}
<b>Pierdere estimata:</b> ${stats.estimatedLoss.toFixed(2)} RON

<b>Per platforma:</b>
Glovo: ${stats.glovo?.uptime || '-'}% uptime
Wolt: ${stats.wolt?.uptime || '-'}% uptime
Bolt: ${stats.bolt?.uptime || '-'}% uptime

<i>Raport generat la ${new Date().toLocaleString('ro-RO')}</i>
    `.trim()

        const keyboard = {
            inline_keyboard: [
                [
                    { text: 'Dashboard', url: 'http://localhost:5533/' },
                    { text: 'Reports', url: 'http://localhost:5533/reports' }
                ]
            ]
        }

        try {
            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'HTML',
                reply_markup: keyboard
            })
            return true
        } catch (error) {
            console.error('   [Telegram] Error sending daily report:', error.message)
            return false
        }
    }

    /**
     * Format stop alert message
     */
    formatStopMessage(restaurant, platform, details) {
        const severityLabel = details.severity === 'critical' ? 'ALERTA CRITICA' : 'AVERTIZARE'
        const platformLabel = platform.toUpperCase()

        return `
<b>${severityLabel} - STOP NEAUTORIZAT</b>

<b>${platformLabel}</b> - Restaurant inchis!

Restaurantul apare <b>inchis</b> in agregator dar ar trebui sa fie <b>deschis</b>.

<b>Probleme detectate:</b>
${details.issues.map(issue => `• ${issue}`).join('\n')}

<b>Restaurant:</b> ${restaurant.name}
<b>Oras:</b> ${restaurant.city || 'N/A'}
<b>Status:</b> ${details.status || 'unknown'}

<i>Detectat automat la ${new Date().toLocaleString('ro-RO')}</i>
    `.trim()
    }

    /**
     * Format duration display
     */
    formatDuration(minutes) {
        if (minutes < 60) {
            return `${minutes} minute`
        }
        const hours = Math.floor(minutes / 60)
        const mins = minutes % 60
        return `${hours}h ${mins}m`
    }

    /**
     * Send test message
     */
    async sendTestMessage(chatId) {
        if (!this.bot) {
            throw new Error('Telegram bot not configured')
        }

        const message = `
<b>Test Message</b>

Telegram bot functioneaza corect!
Butoanele interactive sunt active.

<i>${new Date().toLocaleString('ro-RO')}</i>
    `.trim()

        const keyboard = {
            inline_keyboard: [
                [
                    { text: 'Dashboard', url: 'http://localhost:5533/' },
                    { text: 'OK', callback_data: 'test_ok' }
                ]
            ]
        }

        await this.bot.sendMessage(chatId, message, {
            parse_mode: 'HTML',
            reply_markup: keyboard
        })
        return true
    }
}
