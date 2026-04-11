import { supabase } from './services/supabase.js'
import { GlovoChecker } from './checkers/glovo-checker.js'
import { WoltChecker } from './checkers/wolt-checker.js'
import { BoltChecker } from './checkers/bolt-checker.js'
import { processAndNotify, notifyStopResolved } from './notifications/telegram.js'
import { RulesEngine } from './services/rules-engine.js'
import { LossCalculator } from './services/loss-calculator.js'
import { ownBrandScraper } from './scrapers/own-brand-scraper.js'
import { ReputationScraper } from './scrapers/reputation-scraper.js'
import { CompetitorScraper } from './scrapers/competitor-scraper.js'
import cron from 'node-cron'
import { config } from './config.js'
import { salesSync } from './services/sales-sync.js'


console.log('=== Aggregator Monitor Workers Starting ===')
console.log(`Check interval: ${config.monitoring.checkIntervalMinutes} minutes`)

// The old TelegramNotifier class is replaced by the centralized Antigravity SPRINT 4 Telegram module.
const rulesEngine = new RulesEngine()
const lossCalculator = new LossCalculator()

const checkers = {
    glovo: new GlovoChecker(),
    wolt: new WoltChecker(),
    bolt: new BoltChecker()
}

// ─── HELPER: Working Hours Check ───
function isWithinWorkingHours(restaurant) {
    // If no working_hours defined OR empty object, assume always open
    if (!restaurant.working_hours || Object.keys(restaurant.working_hours).length === 0) {
        return true
    }

    const now = new Date()
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    const currentTime = now.toTimeString().slice(0, 5) // HH:MM

    const daySchedule = restaurant.working_hours[currentDay]
    if (!daySchedule) return false

    return currentTime >= daySchedule.open && currentTime <= daySchedule.close
}

// ─── HELPER: Get Previous Rating ───
async function getPreviousRating(restaurantId, platform) {
    try {
        const { data } = await supabase
            .from('rating_history')
            .select('rating')
            .eq('restaurant_id', restaurantId)
            .eq('platform', platform)
            .order('recorded_at', { ascending: false })
            .limit(2) // Get the 2 most recent to compare

        // Return the second most recent (the one before current check)
        if (data && data.length >= 2) {
            return data[1].rating
        }
        return null
    } catch {
        return null
    }
}

// ─── HELPER: Manage Stop Events ───
async function manageStopEvent(restaurant, platform, isAvailable, checkResult) {
    try {
        // Check for existing active stop
        const { data: activeStop } = await supabase
            .from('stop_events')
            .select('*')
            .eq('restaurant_id', restaurant.id)
            .eq('platform', platform)
            .is('resumed_at', null)
            .order('stopped_at', { ascending: false })
            .limit(1)
            .single()

        if (!isAvailable && !activeStop) {
            // New stop detected → create stop event
            const stopType = checkResult?.raw_data?.product_stops?.stopped > 0 ? 'partial' : 'full'
            const { data: newStop } = await supabase
                .from('stop_events')
                .insert({
                    restaurant_id: restaurant.id,
                    platform,
                    stopped_at: new Date().toISOString(),
                    stop_type: stopType,
                    affected_product_count: checkResult?.raw_data?.product_stops?.stopped || 0,
                    total_product_count: checkResult?.raw_data?.product_stops?.total || 0,
                    reason: checkResult?.final_status === 'closed' ? 'Restaurant closed' : 'Unknown'
                })
                .select()
                .single()

            return { action: 'started', stopEvent: newStop }

        } else if (isAvailable && activeStop) {
            // Restaurant back online → close stop event
            const resumedAt = new Date()
            const stoppedAt = new Date(activeStop.stopped_at)
            const durationMinutes = Math.round((resumedAt - stoppedAt) / (1000 * 60))

            // Calculate loss ONLY if it's our own restaurant. Competitors generate 0 money lost for us when they crash.
            const loss = restaurant.is_competitor ? { estimatedLoss: 0, details: { note: 'Competitor' } } : lossCalculator.calculateStopLoss(restaurant, activeStop)

            await supabase
                .from('stop_events')
                .update({
                    resumed_at: resumedAt.toISOString(),
                    duration_minutes: durationMinutes,
                    estimated_loss_amount: loss.estimatedLoss,
                    loss_calculation_config: loss.details
                })
                .eq('id', activeStop.id)

            return { action: 'resolved', stopEvent: activeStop, duration: durationMinutes, loss: loss.estimatedLoss }
        }

        return { action: 'none' }
    } catch (err) {
        console.error(`   Error managing stop event for ${restaurant.name}/${platform}:`, err.message)
        return { action: 'error' }
    }
}

// ─── MAIN MONITORING CYCLE ───
async function runMonitoringCycle() {
    console.log('\n' + '='.repeat(60))
    console.log(`Monitoring cycle started at ${new Date().toLocaleString('ro-RO')}`)
    console.log('='.repeat(60) + '\n')

    try {
        // Fetch all active restaurants
        const { data: restaurants, error } = await supabase
            .from('restaurants')
            .select('*')
            .eq('is_active', true)

        if (error) {
            console.error('Error fetching restaurants:', error)
            return
        }

        console.log(`Found ${restaurants.length} active restaurant(s)\n`)

        let totalViolations = 0
        let totalLoss = 0

        // Process each restaurant
        for (const restaurant of restaurants) {
            console.log(`--- ${restaurant.name} (${restaurant.city || 'N/A'}) ---`)

            const isWorkingTime = isWithinWorkingHours(restaurant)
            console.log(`  Working hours: ${isWorkingTime ? 'OPEN' : 'Outside hours'}`)

            const platforms = ['glovo', 'wolt', 'bolt']

            for (const platform of platforms) {
                const url = restaurant[`${platform}_url`]
                if (!url) continue

                const checker = checkers[platform]
                if (!checker) continue

                try {
                    const checkResult = await checker.check(restaurant)
                    if (!checkResult) continue

                    const isAvailable = checkResult.final_status === 'available'

                    // ─── MANAGE STOP EVENTS ───
                    if (isWorkingTime) {
                        const stopResult = await manageStopEvent(restaurant, platform, isAvailable, checkResult)

                        if (stopResult.action === 'started') {
                            console.log(`  >> ${restaurant.is_competitor ? 'COMPETITOR ' : ''}STOP DETECTED on ${platform.toUpperCase()}`)
                            
                            // For competitors we instantly fire the Opportunity alert right here!
                            // (Since we skip RulesEngine for them to avoid polluting internal violation tracker)
                            if (restaurant.is_competitor) {
                                // Competitors alert skipped for now pending central architecture
                            }
                        } else if (stopResult.action === 'resolved') {
                            console.log(`  >> ${restaurant.is_competitor ? 'COMPETITOR ' : ''}RECOVERED on ${platform.toUpperCase()} after ${stopResult.duration}min (loss: ${stopResult.loss} RON)`)
                            
                            if (!restaurant.is_competitor) {
                                totalLoss += stopResult.loss
                                // Notify stop resolved via central Antigravity module
                                await notifyStopResolved(restaurant.id, platform, stopResult.duration * 60, stopResult.loss)
                            }
                        }
                    }

                    // ─── EVALUATE RULES (Only for our own restaurants. Competitors don't get Support Tickets/Violation spam) ───
                    if (!restaurant.is_competitor) {
                        const previousRating = await getPreviousRating(restaurant.id, platform)

                    const violations = await rulesEngine.evaluate(restaurant, checkResult, {
                        isWorkingTime,
                        previousRating,
                        rules: null // Will fetch from DB
                    })

                    if (violations.length > 0) {
                        totalViolations += violations.length
                        console.log(`  >> ${violations.length} violation(s) on ${platform.toUpperCase()}:`)
                        for (const v of violations) {
                            console.log(`     [${v.severity.toUpperCase()}] ${v.type}: ${v.message}`)
                        }

                        // Add restaurant_id to violation details
                        for (const v of violations) {
                            v.details = { ...v.details, restaurant_id: restaurant.id }
                        }

                        // Save violations
                        await rulesEngine.saveViolations(violations, checkResult.id)

                        // Create alerts
                        for (const v of violations) {
                            // Calculate estimated loss for this violation
                            let estimatedLoss = null
                            if (v.type === 'unauthorized_stop') {
                                const loss = lossCalculator.calculateStopLoss(restaurant, {
                                    stopped_at: new Date().toISOString(),
                                    platform
                                })
                                estimatedLoss = loss.estimatedLoss
                            } else if (v.type === 'radius_reduction' && v.details?.reduction_percent) {
                                const loss = lossCalculator.calculateRadiusLoss(
                                    restaurant,
                                    v.details.current_radius,
                                    60 // estimate 1 hour
                                )
                                estimatedLoss = loss.estimatedLoss
                            }

                            await supabase.from('alerts').insert({
                                restaurant_id: restaurant.id,
                                restaurant_name: restaurant.name,
                                aggregator: platform,
                                alert_type: v.type,
                                severity: v.severity,
                                title: `${restaurant.name} - ${v.type.replace(/_/g, ' ').toUpperCase()}`,
                                message: v.message + (estimatedLoss ? ` (pierdere estimată: ${estimatedLoss.toFixed(2)} RON)` : ''),
                                is_read: false,
                                is_resolved: false
                            })
                        }

                        // Send Telegram notifications for critical violations is now handled by the generic processAndNotify queue in SPRINT 4

                    } // end if (violations.length > 0)
                    } // end if (!restaurant.is_competitor)
                } catch (err) {
                    console.error(`   Error checking ${restaurant.name} on ${platform}:`, err.message)
                }
            }

            console.log('') // Spacing between restaurants
        }

        console.log(`=== Monitoring cycle completed ===`)
        console.log(`Total violations: ${totalViolations}`)
        console.log(`Total estimated loss: ${totalLoss.toFixed(2)} RON\n`)

    } catch (error) {
        console.error('Error in monitoring cycle:', error)
    }
}

// ─── START ───
// Schedule at peak hours: 11:00, 13:00, 17:00, 18:00, 19:00
const SCHEDULE = '0 11,13,17,18,19 * * *'
console.log(`Scheduling checks at: 11:00, 13:00, 17:00, 18:00, 19:00`)

cron.schedule(SCHEDULE, () => {
    runMonitoringCycle()
})

console.log('Next check will run at the next scheduled hour (11:00, 13:00, 17:00, 18:00 or 19:00)')

// Daily summary cron preserved below...
// (Skipping integration with the new module here since new module handles atomic incidents, not daily aggregates yet)

// ─── Competitive Intelligence: zilnic la 09:00 ───
const competitorScraper = new CompetitorScraper()
cron.schedule('0 9 * * *', async () => {
    console.log('\n🔍 [CRON] Starting daily competitive intelligence scan...')
    try {
        await competitorScraper.runAllSearches()
        console.log('✅ [CRON] Competitive scan complete')
    } catch (err) {
        console.error('❌ [CRON] Competitive scan error:', err.message)
    }
})

// ─── BRAND REPUTATION: la fiecare oră ───
const reputationScraper = new ReputationScraper()
cron.schedule('0 * * * *', async () => {
    console.log('\n🌟 [CRON] Starting hourly Reputation scraping (Phase 1 MVP)...')
    try {
        await reputationScraper.runAllScrapes()
    } catch (err) {
        console.error('❌ [CRON] Reputation scan error:', err.message)
    }
})

// ─── DYNAMIC STOP SCAN SCHEDULER (Verificare Produse) ───
cron.schedule('* * * * *', async () => {
    try {
        const now = new Date()
        const currentHHMM = now.toTimeString().slice(0, 5) // "14:15"
        
        // Fetch rules that match the current time
        const { data: rules, error } = await supabase
            .from('stop_scan_rules')
            .select('*')
            .eq('is_active', true)
            .eq('schedule_time', currentHHMM)

        if (error || !rules || rules.length === 0) return

        for (const rule of rules) {
            console.log(`\n⏰ [SCHEDULER] Triggering rule "${rule.name}" for time ${currentHHMM}`)
            
            // Build query based on scope
            let query = supabase.from('restaurants').select('id, name, city, brand_id, wolt_url, glovo_url, bolt_url, brands(name, logo_url)').eq('is_active', true)
            
            if (rule.scope_type === 'brand' && rule.brand_ids?.length) {
                query = query.in('brand_id', rule.brand_ids)
            } else if (rule.scope_type === 'restaurant' && rule.restaurant_ids?.length) {
                query = query.in('id', rule.restaurant_ids)
            }
            
            const { data: restaurants } = await query
            if (!restaurants || restaurants.length === 0) {
                console.log(`  [SCHEDULER] No active restaurants matched rule "${rule.name}"`)
                continue
            }
            
            console.log(`  [SCHEDULER] Scanning ${restaurants.length} restaurants...`)
            for (const restaurant of restaurants) {
                await ownBrandScraper.scrapeRestaurant(restaurant)
            }
        }
    } catch (err) {
        console.error('❌ [SCHEDULER] Error processing dynamic stop_scan_rules:', err.message)
    }
})


// ─── ANTIGRAVITY SPRINT 4: MAIN TELEGRAM NOTIFIER LOOP ───
// Triggers the generalized notification engine to look for new aggregator_incidents
cron.schedule('*/3 * * * *', async () => {
    console.log('\n🔔 [SCHEDULER] Running Antigravity Telegram processAndNotify...')
    try {
        await processAndNotify()
    } catch (e) {
        console.error('❌ [Notifier] Error:', e.message)
    }
})

// ─── AUTOMATIC IIKO SALES SYNC ───
// Rulam zilnic la ora 04:00 AM pentru a sincroniza zilele din urma pierdute
cron.schedule('0 4 * * *', async () => {
    console.log('\n📈 [SCHEDULER] Running daily automatic Iiko Sales Sync...')
    try {
        await salesSync.syncSales(2) // tragem mereu ultimele 2 zile pt safety
    } catch (err) {
        console.error('❌ [SCHEDULER] Sales Sync error:', err.message)
    }
})

console.log('Workers started successfully!')
console.log('Monitoring schedule: 11:00, 13:00, 17:00, 18:00, 19:00')
console.log('Antigravity Notifier schedule: Every 3 minutes')
console.log('Competitive intelligence scan scheduled for 09:00 daily')
console.log('Brand reputation scan scheduled every hour')
console.log('Automated Daily Sales Sync scheduled for 04:00 AM')
console.log('Press Ctrl+C to stop\n')
