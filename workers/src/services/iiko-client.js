import { supabase } from './supabase.js'

/**
 * iiko Integration Client
 * 
 * Provides interface for fetching restaurant data from iiko POS system:
 * - Product list with categories and prices
 * - Sales data for loss calculation
 * - Product ID mapping (iiko → aggregator)
 * 
 * NOTE: This is a preparatory implementation. Actual API connection
 * requires iiko API credentials configured per restaurant.
 * 
 * Configuration per restaurant (stored in restaurants.iiko_config):
 * {
 *   "api_url": "https://api-eu.iiko.services",
 *   "api_login": "your-login",
 *   "organization_id": "org-uuid",
 *   "terminal_group_id": "terminal-uuid"
 * }
 */
export class IikoClient {
    constructor(restaurant) {
        this.restaurant = restaurant
        this.config = restaurant?.iiko_config || {}
        this.apiUrl = this.config.api_url || 'https://api-eu.iiko.services'
        this.token = null
        this.tokenExpiry = null
    }

    /**
     * Check if iiko is configured for this restaurant
     */
    isConfigured() {
        return !!(this.config.api_login && this.config.organization_id)
    }

    /**
     * Authenticate with iiko API and get access token
     */
    async authenticate() {
        if (!this.isConfigured()) {
            console.log(`   [iiko] Not configured for ${this.restaurant.name}`)
            return false
        }

        // Check if existing token is still valid
        if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return true
        }

        try {
            const response = await fetch(`${this.apiUrl}/api/1/access_token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiLogin: this.config.api_login })
            })

            if (!response.ok) {
                throw new Error(`iiko auth failed: ${response.status}`)
            }

            const data = await response.json()
            this.token = data.token
            // iiko tokens typically expire in 15 minutes
            this.tokenExpiry = Date.now() + 14 * 60 * 1000

            return true
        } catch (err) {
            console.error(`   [iiko] Auth error for ${this.restaurant.name}:`, err.message)
            return false
        }
    }

    /**
     * Fetch product list with categories and prices
     * @returns {Array} products with { id, name, category, price, isAvailable }
     */
    async getProducts() {
        if (!await this.authenticate()) return []

        try {
            const response = await fetch(`${this.apiUrl}/api/1/nomenclature`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    organizationId: this.config.organization_id
                })
            })

            if (!response.ok) {
                throw new Error(`iiko nomenclature failed: ${response.status}`)
            }

            const data = await response.json()
            const products = []

            // Map iiko product groups (categories)
            const categoryMap = {}
            for (const group of (data.groups || [])) {
                categoryMap[group.id] = group.name
            }

            // Map products
            for (const product of (data.products || [])) {
                products.push({
                    iiko_id: product.id,
                    name: product.name,
                    category: categoryMap[product.parentGroup] || 'Uncategorized',
                    category_id: product.parentGroup,
                    price: product.sizePrices?.[0]?.price?.currentPrice || 0,
                    is_available: !product.isDeleted,
                    sku: product.code,
                    weight: product.weight,
                    measure_unit: product.measureUnit,
                    image: product.imageLinks?.[0] || null
                })
            }

            return products
        } catch (err) {
            console.error(`   [iiko] Error fetching products for ${this.restaurant.name}:`, err.message)
            return []
        }
    }

    /**
     * Fetch recent sales data
     * @param {string} dateFrom - ISO date (YYYY-MM-DD)
     * @param {string} dateTo - ISO date (YYYY-MM-DD)
     * @returns {Array} sales records
     */
    async getSalesData(dateFrom, dateTo) {
        if (!await this.authenticate()) return []

        try {
            const response = await fetch(`${this.apiUrl}/api/1/deliveries/by_delivery_date_and_status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    organizationIds: [this.config.organization_id],
                    deliveryDateFrom: dateFrom,
                    deliveryDateTo: dateTo,
                    statuses: ['Delivered']
                })
            })

            if (!response.ok) {
                throw new Error(`iiko sales failed: ${response.status}`)
            }

            const data = await response.json()
            const sales = []

            for (const order of (data.deliveryOrders || [])) {
                for (const item of (order.items || [])) {
                    sales.push({
                        order_id: order.id,
                        order_date: order.completionDate || order.deliveryDate,
                        product_id: item.productId,
                        product_name: item.name,
                        quantity: item.amount,
                        price: item.resultSum,
                        total: item.resultSum * item.amount
                    })
                }
            }

            return sales
        } catch (err) {
            console.error(`   [iiko] Error fetching sales for ${this.restaurant.name}:`, err.message)
            return []
        }
    }

    /**
     * Map iiko products to aggregator products
     * Uses name matching since aggregators don't expose iiko IDs
     * 
     * @param {Array} iikoProducts - products from iiko
     * @param {Array} aggregatorProducts - products scraped from aggregator
     * @returns {Array} mapped products with match confidence
     */
    mapProducts(iikoProducts, aggregatorProducts) {
        const mapped = []

        for (const iikoProduct of iikoProducts) {
            const iikoName = iikoProduct.name.toLowerCase().trim()

            // Try exact match first, then fuzzy
            let bestMatch = null
            let bestScore = 0

            for (const aggProduct of aggregatorProducts) {
                const aggName = aggProduct.name?.toLowerCase().trim() || ''

                // Exact match
                if (iikoName === aggName) {
                    bestMatch = aggProduct
                    bestScore = 100
                    break
                }

                // Partial match (both directions)
                if (iikoName.includes(aggName) || aggName.includes(iikoName)) {
                    const score = Math.max(iikoName.length, aggName.length) > 0
                        ? (Math.min(iikoName.length, aggName.length) / Math.max(iikoName.length, aggName.length)) * 80
                        : 0
                    if (score > bestScore) {
                        bestMatch = aggProduct
                        bestScore = score
                    }
                }
            }

            mapped.push({
                iiko_product: iikoProduct,
                aggregator_product: bestMatch,
                match_confidence: bestScore,
                is_matched: bestScore > 50
            })
        }

        return mapped
    }

    /**
     * Calculate revenue per hour based on historical iiko sales
     * Updates the restaurant record with calculated revenue
     */
    async calculateRevenuePerHour() {
        // Get last 30 days of sales
        const dateTo = new Date().toISOString().split('T')[0]
        const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

        const sales = await this.getSalesData(dateFrom, dateTo)
        if (sales.length === 0) return null

        // Calculate total revenue
        const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0)

        // Get working hours per day (approximate 12 hours)
        const workingHoursPerDay = 12
        const daysInPeriod = 30

        const revenuePerHour = totalRevenue / (daysInPeriod * workingHoursPerDay)

        // Update restaurant record
        if (revenuePerHour > 0) {
            await supabase
                .from('restaurants')
                .update({ revenue_per_hour: parseFloat(revenuePerHour.toFixed(2)) })
                .eq('id', this.restaurant.id)
        }

        return {
            totalRevenue: parseFloat(totalRevenue.toFixed(2)),
            revenuePerHour: parseFloat(revenuePerHour.toFixed(2)),
            salesCount: sales.length,
            period: { from: dateFrom, to: dateTo }
        }
    }

    /**
     * Fetch the active stop list (out of stock items) from the kitchen POS
     * @returns {Array} List of product IDs or names currently stopped
     */
    async getStopList() {
        if (!await this.authenticate()) return []

        try {
            const response = await fetch(`${this.apiUrl}/api/1/stop_lists`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    organizationIds: [this.config.organization_id]
                })
            })

            if (!response.ok) {
                throw new Error(`iiko stop_lists failed: ${response.status}`)
            }

            const data = await response.json()
            const stoppedItemIds = new Set()

            if (data.terminalGroupStopLists) {
                for (const tg of data.terminalGroupStopLists) {
                     for (const item of (tg.items || [])) {
                          stoppedItemIds.add(item.productId)
                     }
                }
            }
            
            // Map IDs to names if we have the products array cached or we fetch it
            const products = await this.getProducts()
            const productMap = {}
            for (const p of products) {
                 productMap[p.iiko_id] = p.name
            }

            const stoppedProducts = []
            for (const id of stoppedItemIds) {
                 stoppedProducts.push({
                     iiko_id: id,
                     name: productMap[id] || id,
                     is_stopped_in_pos: true
                 })
            }

            return stoppedProducts
        } catch (err) {
            console.error(`   [iiko] Error fetching stop list for ${this.restaurant.name}:`, err.message)
            return []
        }
    }
}
