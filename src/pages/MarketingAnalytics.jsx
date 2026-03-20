import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { supabase } from '../lib/supabaseClient'
import { getSmartSearchWords } from '../lib/searchUtils'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList,
    ComposedChart, Line, ReferenceLine, Scatter
} from 'recharts'

const CITY_FLAGS = {
    'Bucharest': '🏙️', 'Cluj-Napoca': '🌄', 'Timisoara': '🌉', 'Iasi': '🏙️',
    'Constanta': '🌊', 'Brasov': '🏄', 'Galati': '🏗️', 'Sibiu': '🏰',
    'Pitesti': '🌳', 'Craiova': '🌿', 'Oradea': '🎠', 'Arad': '🌾',
    'Targu Mures': '🏡', 'Bacau': '🏠', 'Ploiesti': '⛽', 'Ramnicu Valcea': '🍃',
    'Suceava': '🦨', 'Baia Mare': '⛏️',
}

const PREVIEW_ROWS = 10

export default function MarketingAnalytics() {
    const navigate = useNavigate()
    const { colors, isDark } = useTheme()
    const { lang } = useLanguage()

    const [realData, setRealData] = useState([])
    const [ownDataState, setOwnDataState] = useState([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const PAGE_SIZE = 15
    const [selectedProduct, setSelectedProduct] = useState(null)
    const [collapsedCities, setCollapsedCities] = useState({})
    const toggleCity = (city) => setCollapsedCities(prev => ({ ...prev, [city]: !prev[city] }))

    // Filters
    const [selectedCategory, setSelectedCategory] = useState('Sushi')
    const [filterCity, setFilterCity] = useState('')
    const [filterOwnBrand, setFilterOwnBrand] = useState('')
    const [filterCompBrand, setFilterCompBrand] = useState('')
    const [search, setSearch] = useState('')
    const [productType, setProductType] = useState('both') // 'food' | 'drink' | 'both'
    const [refreshKey, setRefreshKey] = useState(0)
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

    // Options
    const [cities, setCities] = useState([])
    const [compBrands, setCompBrands] = useState([])
    const [ownBrands, setOwnBrands] = useState([])

    useEffect(() => {
        async function loadFilters() {
            try {
                const { data: cr } = await supabase.from('competitor_restaurants').select('name')
                if (cr) {
                    setCompBrands([...new Set(cr.map(d => d.name).filter(Boolean))].sort())
                }
                const { data: br } = await supabase.from('brands').select('name')
                if (br) {
                    setOwnBrands([...new Set(br.map(d => d.name).filter(Boolean))].sort())
                }
                // Cities come from OWN restaurants (all 22 cities), not from competitor_products (only 2 cities)
                const { data: ownCities } = await supabase.from('restaurants').select('city').eq('is_active', true)
                if (ownCities) {
                    setCities([...new Set(ownCities.map(d => d.city).filter(Boolean))].sort())
                }
            } catch (err) {}
        }
        loadFilters()
    }, [])

    // Dummy trend values since trend requires historical snapshots over weeks
    const mockTrend = [
        { date: '01 Mar', index: 100 },
        { date: '05 Mar', index: 102 },
        { date: '10 Mar', index: 98 },
        { date: '15 Mar', index: 105 },
        { date: '20 Mar', index: 110 },
    ]

    useEffect(() => {
        async function loadData() {
            setLoading(true)
            try {
                // Strategy: fetch per city in parallel to ensure ALL cities appear
                // A single global query truncates at 50-100k and misses many cities
                const ALL_CITIES = ['Bucharest','Cluj-Napoca','Timisoara','Iasi','Constanta','Brasov','Galati','Sibiu','Craiova','Ploiesti','Oradea','Arad','Bacau','Suceava']
                const citiesToFetch = filterCity ? [filterCity] : ALL_CITIES

                const cityResults = await Promise.all(citiesToFetch.map(async (city) => {
                    // First find the most recent snapshot_date for this city
                    const { data: latestRow } = await supabase
                        .from('competitor_products')
                        .select('snapshot_date')
                        .eq('city', city)
                        .order('snapshot_date', { ascending: false })
                        .limit(1)

                    if (!latestRow || latestRow.length === 0) return []

                    const latestDate = latestRow[0].snapshot_date

                    // Check if latest date is within user-specified range
                    if (startDate && latestDate < startDate) return []
                    if (endDate && latestDate > endDate) return []

                    // Fetch products for this city from the latest snapshot
                    let q = supabase
                        .from('competitor_products')
                        .select('product_name, category, price, description, city, snapshot_date, platform, image_url, competitor_restaurants(name, logo_url, url)')
                        .eq('city', city)
                        .eq('snapshot_date', latestDate)
                        .order('category', { ascending: true })

                    if (selectedCategory) q = q.ilike('category', `%${selectedCategory}%`)
                    if (filterCompBrand) q = q.ilike('competitor_restaurants.name', `%${filterCompBrand}%`)
                    if (search) {
                        const searchWords = getSmartSearchWords(search)
                        if (searchWords.length > 0) {
                            searchWords.forEach(w => {
                                q = q.ilike('product_name', `%${w}%`)
                            })
                        }
                    }

                    const { data } = await q.limit(5000)
                    return data || []
                }))

                const comp = cityResults.flat()

                // Get our brand categories directly from the brands table
                const { data: allBrands } = await supabase.from('brands').select('*')

                // Try to find matching own products for real comparison
                let ownQuery = supabase
                    .from('own_product_snapshots')
                    .select('product_name, price, city, platform, image_url, snapshot_date, category, brands(name, logo_url)')
                    .order('snapshot_date', { ascending: false })
                    .limit(10000)
                
                if (filterCity) ownQuery = ownQuery.eq('city', filterCity)
                
                const { data: own } = await ownQuery
                setOwnDataState(own || [])

                const ownMap = {}
                const normalizedOwnMap = {}
                const matchedOwnIds = new Set()

                const normalizeName = (n) => {
                    if (!n) return '';
                    let s = n.toLowerCase().trim();
                    s = s.replace(/we love /g, '');
                    s = s.replace(/crevete|creveți|creveti|shrimps|ebi/g, 'shrimp');
                    s = s.replace(/\bton\b|tuna/g, 'tuna');
                    s = s.replace(/crabi|crab/g, 'crab');
                    s = s.replace(/phila\b/g, 'philadelphia');
                    s = s.replace(/fume|afumat/g, 'fume');
                    return s.split(/[\s\-]+/).filter(w => w.length > 2 && w !== 'sus' && w !== 'cu').sort().join(' ');
                }

                if (own) {
                    own.forEach((o, index) => {
                        o['_myId'] = index;
                        const brandData = o.brands || {}
                        const brandObj = Array.isArray(brandData) ? brandData[0] : brandData
                        const brandName = brandObj?.name || ''
                        const brandLogo = brandObj?.logo_url || ''
                        if (!filterOwnBrand || brandName.toLowerCase().includes(filterOwnBrand.toLowerCase())) {
                            const pName = o.product_name || '';
                            const keyWithCity = `${pName.trim().toLowerCase()}___${o.city || ''}`
                            const keyAnyCity = `${pName.trim().toLowerCase()}___`
                            const val = { price: o.price, brand: brandName, logo: brandLogo, _myId: o['_myId'] }
                            
                            ownMap[keyWithCity] = val
                            if (!ownMap[keyAnyCity]) ownMap[keyAnyCity] = val
                            
                            const normKey = `${normalizeName(pName)}___${o.city || ''}`
                            const normKeyAny = `${normalizeName(pName)}___`
                            if (normalizeName(pName)) {
                                if (!normalizedOwnMap[normKey]) normalizedOwnMap[normKey] = val
                                if (!normalizedOwnMap[normKeyAny]) normalizedOwnMap[normKeyAny] = val
                            }
                        }
                    })
                }

                if (comp) {
                    const parsed = comp.map(p => {
                        const fullName = p.product_name || ''
                        const desc = p.description || ''
                        const fullText = fullName + ' ' + desc
                        
                        // Extract weight (grams, ml)
                        const weightMatch = fullText.match(/(\d+)\s*(g|gr|ml|kg)\b/i)
                        const weight = weightMatch ? `${weightMatch[1]}${weightMatch[2].toLowerCase()}` : '—'
                        
                        // Extract pieces
                        let pcsMatch = fullText.match(/\b(\d+)\s*(bucati|bucăți|buc|pcs|pieces|role|roll|rolls|buc\.)\b/i)
                        if (!pcsMatch) pcsMatch = fullText.match(/(?:x\s*(\d+)|\b(\d+)\s*x\b)/i)
                        if (!pcsMatch) pcsMatch = fullText.match(/\((\d+)\)/) // e.g. (8)
                        if (!pcsMatch) pcsMatch = fullText.match(/(\d+)\s*(?:buc|role|pcs)/i) // fallback without boundary

                        let pieces = '1'
                        if (pcsMatch) {
                            pieces = pcsMatch[1] || pcsMatch[2] || pcsMatch[3] || pcsMatch[0].replace(/\D/g, '')
                        }

                        // Parse numeric weight for scatter plot
                        const weightNum = weightMatch ? (Math.round((weightMatch[2].toLowerCase() === 'kg' ? Number(weightMatch[1]) * 1000 : Number(weightMatch[1])))) : 0;

                        
                        // Extract platform
                        const platform = p.platform || 'glovo'

                        const compPrice = Number(p.price) || 0
                        const compCity = p.city || ''
                        const restData = p.competitor_restaurants || {}
                        const compBrandObj = Array.isArray(restData) ? restData[0] : restData
                        const compBrand = compBrandObj?.name || 'Concurent'
                        const compLogo = compBrandObj?.logo_url || ''
                        const compUrl = compBrandObj?.url || ''

                        
                        let exactOwn = ownMap[`${fullName.trim().toLowerCase()}___${compCity}`]
                        if (!exactOwn) exactOwn = ownMap[`${fullName.trim().toLowerCase()}___`]
                        if (!exactOwn) exactOwn = normalizedOwnMap[`${normalizeName(fullName)}___${compCity}`]
                        if (!exactOwn) exactOwn = normalizedOwnMap[`${normalizeName(fullName)}___`]
                        
                        // Fallback la o potrivire parțială: dacă toate cuvintele din produsul nostru se regăsesc în produsul concurent, e considerat o potrivire (e.g. 'classic shrimp' vs 'shrimp')
                        if (!exactOwn && normalizeName(fullName)) {
                            const compWords = normalizeName(fullName).split(' ');
                            if (compWords.length > 0) {
                                // gasim cel mai bun match din ownMap
                                const bestMatchKey = Object.keys(normalizedOwnMap).find(k => {
                                    const ownW = k.split('___')[0];
                                    if (!ownW || ownW.length < 4) return false;
                                    const ownWords = ownW.split(' ');
                                    
                                    // Protectie anti-potrivire gresita intre ingredientele principale
                                    const criticalIngredients = ['somon', 'salmon', 'ton', 'tuna', 'shrimp', 'crevete', 'creveti', 'pui', 'chicken', 'vita', 'beef', 'porc', 'pork', 'veg', 'vegan']
                                    const compCriticals = compWords.filter(w => criticalIngredients.includes(w))
                                    const ownCriticals = ownWords.filter(w => criticalIngredients.includes(w))
                                    
                                    // Dacă unul are un ingredient principal pe care celălalt NU îl are, atunci NU e același produs (ex: Sushi Burger Somon vs Sushi Burger Creveti)
                                    const hasConflictingIngredients = compCriticals.some(c => ownCriticals.length > 0 && !ownCriticals.includes(c)) || 
                                                                      ownCriticals.some(o => compCriticals.length > 0 && !compCriticals.includes(o))
                                    if (hasConflictingIngredients) return false;

                                    // Dacă măcar primele 2 cuvinte sunt la fel (sau regulă de intersecție)
                                    const intersection = ownWords.filter(w => compWords.includes(w));
                                    return intersection.length >= Math.max(ownWords.length - 1, 1) && intersection.length >= Math.max(compWords.length - 1, 1);
                                });
                                if (bestMatchKey) exactOwn = normalizedOwnMap[bestMatchKey];
                            }
                        }

                        if (exactOwn) {
                            matchedOwnIds.add(exactOwn._myId);
                        }
                        
                        let fallbackBrandObj = null;
                        let compCat = p.category || '';

                        // Normalize category aliases → Doner
                        if (/(saorma|shaorma|kebab|kabab|kebap|kabap|doner|döner)/i.test(compCat) || /(saorma|shaorma|kebab|kabab|doner|döner)/i.test(fullName)) {
                            compCat = 'Doner';
                        }

                        // Food/Drink Filter logic
                        let isDrink = /(băutur|bautur|drink|beverage|cola|pepsi|suc|apă|apa\b|răcorit|racorit|bere|vin|red\s*bull|7up|mirinda|fanta|sprite)/i.test(compCat) || /(cola|pepsi|suc|apă|apa\b|răcorit|racorit|bere|vin|red\s*bull|7up|mirinda|fanta|sprite)/i.test(fullName);
                        let pType = isDrink ? 'drink' : 'food';

                        if (productType === 'food' && pType === 'drink') return null;
                        if (productType === 'drink' && pType === 'food') return null;

                        // Find our brand match (optional - just for price comparison display)
                        if (allBrands && allBrands.length > 0) {
                            if (exactOwn) {
                                fallbackBrandObj = allBrands.find(b => b.name === exactOwn.brand) || null;
                                // If filtering by own brand, exclude products that belong to other brands
                                if (filterOwnBrand && fallbackBrandObj && fallbackBrandObj.name.toLowerCase() !== filterOwnBrand.toLowerCase()) {
                                    return null;
                                }
                                if (filterOwnBrand && !fallbackBrandObj) {
                                    return null;
                                }
                            } else {
                                for (const b of allBrands) {
                                    if (filterOwnBrand && b.name.toLowerCase() !== filterOwnBrand.toLowerCase()) continue;
                                    if (b.categories && b.categories.trim() !== '') {
                                        const allowedCats = b.categories.split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
                                        if (allowedCats.some(c => compCat.toLowerCase().includes(c) || fullName.toLowerCase().includes(c))) {
                                            fallbackBrandObj = b;
                                            break;
                                        }
                                    } else if (filterOwnBrand) {
                                        fallbackBrandObj = b;
                                        break;
                                    }
                                }
                                // If filterOwnBrand is set but no match found, exclude
                                if (filterOwnBrand && !fallbackBrandObj) {
                                    return null;
                                }
                            }
                        }

                        // Show ALL competitor products - no longer restrict to only matched ones
                        let ourPrice = exactOwn ? Number(exactOwn.price) : 0;
                        let ourLogo = exactOwn ? exactOwn.logo : (fallbackBrandObj?.logo_url || '');
                        let ourBrand = exactOwn ? exactOwn.brand : (fallbackBrandObj?.name || '');

                        return {
                            name: fullName,
                            description: p.description || '',
                            category: compCat || 'N/A',
                            ournPrice: ourPrice,
                            hasExactMatch: !!exactOwn,
                            ourBrand: ourBrand,
                            ourLogo: ourLogo,
                            compPrice: compPrice,
                            compBrand: compBrand,
                            compLogo: compLogo,
                            compUrl: compUrl,
                            compCity: compCity,
                            weight,
                            weightNum,
                            pieces: pieces,
                            platform,
                            snapshot_date: p.snapshot_date ? p.snapshot_date.split('T')[0] : '—',
                            image_url: p.image_url || '',
                            isOwnOnly: false
                        }
                    }).filter(p => p !== null && p.compPrice > 0)

                    // Injectăm produsele proprii care corespund căutării/categoriei, dar NU au avut concurent (pentru a afișa orașele lipsă)
                    if (own) {
                        own.forEach(o => {
                            if (matchedOwnIds.has(o['_myId'])) return;
                            
                            let matchSearch = true;
                            if (search) {
                                const searchWords = getSmartSearchWords(search);
                                if (searchWords.length > 0) {
                                    const oName = o.product_name.toLowerCase();
                                    const oCat = (o.category || '').toLowerCase();
                                    const bData = o.brands || {};
                                    const bObj = Array.isArray(bData) ? bData[0] : bData;
                                    const restName = (bObj?.name || '').toLowerCase();

                                    matchSearch = searchWords.every(w => {
                                        if (oName.includes(w) || oCat.includes(w)) return true;
                                        if (w === 'sushi' && restName.includes('sushi')) return true;
                                        return false;
                                    });
                                }
                            }
                            
                            let matchCat = true;
                            if (selectedCategory && selectedCategory !== 'Sushi' && selectedCategory !== 'Meniu') {
                                matchCat = o.product_name.toLowerCase().includes(selectedCategory.toLowerCase());
                            }
                            
                            // Nu adaugam produse fara concurenta daca nu facem un search specific
                            if (search && matchSearch && matchCat) {
                                const brandData = o.brands || {}
                                const brandObj = Array.isArray(brandData) ? brandData[0] : brandData
                                
                                parsed.push({
                                    name: o.product_name,
                                    description: '',
                                    category: selectedCategory || 'N/A',
                                    ournPrice: o.price,
                                    hasExactMatch: true,
                                    ourBrand: brandObj?.name || 'Brand Propriu',
                                    ourLogo: brandObj?.logo_url || '',
                                    compPrice: 0,
                                    compBrand: 'Fără concurență',
                                    compLogo: '',
                                    compUrl: '',
                                    compCity: o.city,
                                    weight: '—',
                                    weightNum: 0,
                                    pieces: '1',
                                    platform: o.platform || 'glovo',
                                    snapshot_date: o.snapshot_date ? o.snapshot_date.split('T')[0] : Object.values(ownMap)[0]?.snapshot_date?.split('T')[0] || new Date().toISOString().split('T')[0],
                                    image_url: o.image_url || '',
                                    isOwnOnly: true
                                })
                            }
                        })
                    }

                    // Păstrăm ultima actualizare (fiind sortdesc) dar dacă poza s-a pierdut în re-scrapes viitoare (fără imagine), 
                    // luăm poza de la snapshot-urile mai vechi din listă.
                    const uniqueProducts = {}
                    parsed.forEach(p => {
                        const key = `${p.compBrand}_${p.name}_${p.platform}_${p.compCity}`
                        if (!uniqueProducts[key]) {
                            uniqueProducts[key] = { ...p }
                        } else {
                            if (!uniqueProducts[key].image_url && p.image_url) {
                                uniqueProducts[key].image_url = p.image_url
                            }
                        }
                    })

                    setRealData(Object.values(uniqueProducts))
                    setPage(1)
                }
            } catch (err) {
                console.error(err)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [selectedCategory, filterCity, filterCompBrand, filterOwnBrand, search, startDate, endDate, productType, refreshKey])

    const avgDiff = useMemo(() => {
        const matched = realData.filter(r => r.hasExactMatch && r.ournPrice > 0 && r.compPrice > 0)
        if (!matched.length) return 0
        const totalOur = matched.reduce((sum, item) => sum + item.ournPrice, 0)
        const totalComp = matched.reduce((sum, item) => sum + item.compPrice, 0)
        if (totalComp === 0) return 0
        return ((totalOur - totalComp) / totalComp) * 100
    }, [realData])

    // Top 8 products for chart (only exact matches to avoid meaningless diffs)
    const chartData = useMemo(() => {
        return realData.filter(r => r.hasExactMatch && r.ournPrice > 0 && r.compPrice > 0).slice(0, 8)
    }, [realData])

    // Competitor Analysis chart data
    const compAnalysis = useMemo(() => {
        const compAverages = {}
        const matched = realData.filter(r => r.hasExactMatch && r.ournPrice > 0 && r.compPrice > 0)
        matched.forEach(item => {
            if (!compAverages[item.compBrand]) {
                compAverages[item.compBrand] = { brand: item.compBrand, totalDiff: 0, count: 0 }
            }
            const diffPerc = ((item.compPrice - item.ournPrice) / item.ournPrice) * 100
            compAverages[item.compBrand].totalDiff += diffPerc
            compAverages[item.compBrand].count += 1
        })
        return Object.values(compAverages)
            .map(c => ({ name: c.brand, diffPercent: Number((c.totalDiff / c.count).toFixed(1)) }))
            .sort((a,b) => b.diffPercent - a.diffPercent)
            .slice(0, 8)
    }, [realData])

    // Sophisticated Scatter Data (Value for money)
    const scatterMarketData = useMemo(() => {
        const points = []
        realData.forEach(r => {
            if (r.weightNum > 0) {
                if (r.compPrice > 0) {
                    points.push({ name: r.name, brand: r.compBrand, price: r.compPrice, weight: r.weightNum, type: 'Piață', fill: '#6366F1' })
                }
                if (r.ournPrice > 0) {
                    points.push({ name: r.name, brand: r.ourBrand, price: r.ournPrice, weight: r.weightNum, type: 'Noi', fill: '#EF4444' })
                }
            }
        })
        return points
    }, [realData])

    // Sophisticated Trend Data
    const trendData = useMemo(() => {
        const byDate = {}
        realData.forEach(r => {
            if (!r.snapshot_date || r.snapshot_date === '—') return
            if (r.hasExactMatch && r.ournPrice > 0 && r.compPrice > 0) {
                if (!byDate[r.snapshot_date]) byDate[r.snapshot_date] = { date: r.snapshot_date, ourSum: 0, compSum: 0, count: 0 }
                byDate[r.snapshot_date].ourSum += r.ournPrice
                byDate[r.snapshot_date].compSum += r.compPrice
                byDate[r.snapshot_date].count++
            }
        })
        const points = Object.values(byDate)
            .map(d => ({
                date: new Date(d.date).toLocaleDateString('ro-RO', { month: 'short', day: 'numeric' }),
                IndexConcurenta: 100,
                IndexNoi: Number(((d.ourSum / d.compSum) * 100).toFixed(1))
            }))
            .sort((a, b) => new Date(a.date) - new Date(b.date))
        
        // Fallback to mock trend if historical is empty
        return points.length > 0 ? points : mockTrend.map(m => ({ date: m.date, IndexConcurenta: 100, IndexNoi: m.index }))
    }, [realData])

    // Global average for our brand matching the filter
    const ourGlobalAvg = useMemo(() => {
        if (!ownDataState.length) return null
        const filtered = ownDataState.filter(o => {
            const matchCat = !selectedCategory || o.product_name.toLowerCase().includes(selectedCategory.toLowerCase())
            const matchSearch = !search || o.product_name.toLowerCase().includes(search.toLowerCase())
            return matchCat && matchSearch
        })
        if (!filtered.length) return null
        return Number((filtered.reduce((s, x) => s + x.price, 0) / filtered.length).toFixed(1))
    }, [ownDataState, selectedCategory, search])

    // Smart Min/Avg/Max chart per category — shows where we stand vs market
    const minAvgMaxChart = useMemo(() => {
        const catMap = {}
        const isProductAnalysis = search && search.trim().length > 1;

        realData.forEach(r => {
            let cat = r.category || 'Altele'
            let display = cat
            // Dacă am căutat un anumit produs (ex. california), spargem graficul în detalii per produs!
            if (isProductAnalysis) {
                // eliminam brandul competitorului din nume si alte zgomote daca exista pentru o agregare buna
                cat = r.name.toLowerCase().trim()
                display = r.name
            }

            if (!catMap[cat]) catMap[cat] = { compPrices: [], ourPrices: [], display }
            if (r.compPrice > 0) catMap[cat].compPrices.push(r.compPrice)
            if (r.hasExactMatch && r.ournPrice > 0 && r.compPrice > 0) catMap[cat].ourPrices.push(r.ournPrice)
        })
        return Object.values(catMap)
            .filter(v => isProductAnalysis ? v.compPrices.length >= 1 : v.compPrices.length >= 3)
            .map(v => {
                const sorted = [...v.compPrices].map(Number).sort((a, b) => a - b)
                const min = sorted[0]
                const max = sorted[sorted.length - 1]
                const avg = sorted.reduce((s, x) => Number(s) + Number(x), 0) / sorted.length
                const localOurAvg = v.ourPrices.length > 0
                    ? v.ourPrices.reduce((s, x) => Number(s) + Number(x), 0) / v.ourPrices.length
                    : null
                return {
                    name: v.display.length > 18 ? v.display.substring(0, 18) + '…' : v.display,
                    fullName: v.display,
                    min: Number(min.toFixed(1)),
                    avg: Number(avg.toFixed(1)),
                    max: Number(max.toFixed(1)),
                    ourAvg: localOurAvg ? Number(localOurAvg.toFixed(1)) : ourGlobalAvg,
                    spread: Number((max - min).toFixed(1)),
                    count: sorted.length,
                }
            })
            // cand suntem la nivel de produs, sortam dupa raspandire (count), cand e pe categorii, la fel
            .sort((a, b) => b.count - a.count)
            .slice(0, isProductAnalysis ? 15 : 10)
    }, [realData, ourGlobalAvg, search])

    // Group analysed data by city
    const byCityData = useMemo(() => {
        const map = {}
        realData.forEach(p => {
            const city = p.compCity || 'Necunoscut'
            if (!map[city]) map[city] = []
            map[city].push(p)
        })
        return map
    }, [realData])

    // Category Analysis
    const catAnalysis = useMemo(() => {
        const catAverages = {}
        const matched = realData.filter(r => r.hasExactMatch && r.ournPrice > 0 && r.compPrice > 0)
        matched.forEach(item => {
            if (!catAverages[item.category]) {
                catAverages[item.category] = { category: item.category, totalDiff: 0, count: 0 }
            }
            const diffPerc = ((item.compPrice - item.ournPrice) / item.ournPrice) * 100
            catAverages[item.category].totalDiff += diffPerc
            catAverages[item.category].count += 1
        })
        return Object.values(catAverages)
            .map(c => ({ name: c.category, diffPercent: Number((c.totalDiff / c.count).toFixed(1)) }))
            .sort((a,b) => b.diffPercent - a.diffPercent)
            .slice(0, 6)
    }, [realData])

    const COLORS_BAR = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6']

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', animation: 'fadeUp 0.4s ease-out' }}>
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: '800', color: colors.text, margin: '0 0 4px 0', letterSpacing: '-0.5px' }}>
                        {lang === 'en' ? 'Market Analytics' : 'Analize & KPI Piață'}
                    </h1>
                    <p style={{ margin: 0, color: colors.textSecondary, fontSize: '14px' }}>
                        {lang === 'en' ? 'Compare product prices, study trends, and track competitiveness.' : 'Date extrase real-time din baza de date pentru gramaje și produse.'}
                    </p>
                </div>
                <button onClick={() => setRefreshKey(k => k + 1)}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#10B981', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-13.51l5.25 5.12"/></svg>
                    {lang === 'en' ? 'Refresh Data' : 'Actualizare Date'}
                </button>
            </div>

            {/* Quick Filters */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px', background: isDark ? 'rgba(255,255,255,0.02)' : '#fff', padding: '16px', borderRadius: '16px', border: `1px solid ${colors.border}` }}>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '4px', alignItems: 'center' }}>
                    {['', 'Sushi', 'Sushi Burger', 'Sushi Dog', 'Burger', 'Pizza', 'Doner', 'Asia', 'Meniu'].map(cat => {
                        // Tratam separat cazuistica butoanelor cu produse specifice vs categorii mari
                        const isProduct = cat === 'Sushi Burger' || cat === 'Sushi Dog'
                        const isActive = isProduct 
                            ? search.toLowerCase() === cat.toLowerCase()
                            : (selectedCategory || '').toLowerCase() === cat.toLowerCase() && search === ''
                            
                        return (
                            <button key={cat} onClick={() => {
                                if (isProduct) {
                                    setSearch(cat)
                                    setSelectedCategory('')
                                } else {
                                    setSelectedCategory(cat)
                                    setSearch('')
                                }
                            }}
                                style={{ padding: '6px 14px', borderRadius: '20px', border: isActive ? 'none' : `1px solid ${colors.border}`, background: isActive ? '#6366F1' : (isDark ? 'rgba(255,255,255,0.05)' : '#fff'), color: isActive ? '#fff' : colors.text, fontSize: '12px', fontWeight: '600', cursor: 'pointer', flexShrink: 0, boxShadow: isActive ? '0 4px 12px rgba(99,102,241,0.3)' : 'none', transition: 'all 0.2s ease' }}>
                                {cat === '' ? 'Toate Categoriile' : cat}
                            </button>
                        )
                    })}
                    <div style={{ width: '1px', height: '20px', background: colors.border, margin: '0 4px', flexShrink: 0 }}></div>
                    {[{ id: 'both', label: 'Toate Produsele' }, { id: 'food', label: 'Mâncare' }, { id: 'drink', label: 'Băuturi' }].map(pt => {
                        const isActive = productType === pt.id
                        return (
                            <button key={pt.id} onClick={() => setProductType(pt.id)}
                                style={{ padding: '6px 14px', borderRadius: '20px', border: isActive ? 'none' : `1px solid ${colors.border}`, background: isActive ? '#10B981' : (isDark ? 'rgba(255,255,255,0.05)' : '#fff'), color: isActive ? '#fff' : colors.text, fontSize: '12px', fontWeight: '600', cursor: 'pointer', flexShrink: 0, boxShadow: isActive ? '0 4px 12px rgba(16,185,129,0.3)' : 'none', transition: 'all 0.2s ease' }}>
                                {pt.label}
                            </button>
                        )
                    })}
                </div>
                <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '4px', alignItems: 'center' }}>
                    <select value={filterCity} onChange={e => setFilterCity(e.target.value)}
                        style={{ flexShrink: 0, minWidth: '120px', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(0,0,0,0.2)' : '#f9fafb', color: colors.text, fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
                        <option value="">{lang === 'en' ? 'All Cities' : 'Toate Orașele'}</option>
                        {cities.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: isDark ? 'rgba(0,0,0,0.2)' : '#f9fafb', padding: '4px 8px', borderRadius: '8px', border: `1px solid ${colors.border}`, flexShrink: 0 }}>
                        <span style={{ fontSize: '12px', color: colors.textSecondary, fontWeight: '600' }}>Perioadă:</span>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '6px', border: 'none', background: 'transparent', color: colors.text, fontSize: '12px', outline: 'none' }} />
                        <span style={{ color: colors.textSecondary }}>-</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '6px', border: 'none', background: 'transparent', color: colors.text, fontSize: '12px', outline: 'none' }} />
                    </div>
                    <input placeholder={lang === 'en' ? 'Search product...' : 'Caută produs...'} value={search} onChange={e => setSearch(e.target.value)}
                        style={{ flexShrink: 0, width: '150px', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(0,0,0,0.2)' : '#f9fafb', color: colors.text, fontSize: '13px', outline: 'none' }} />
                    <select value={filterOwnBrand} onChange={e => setFilterOwnBrand(e.target.value)}
                        style={{ flexShrink: 0, minWidth: '120px', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(0,0,0,0.2)' : '#f9fafb', color: colors.text, fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
                        <option value="">{lang === 'en' ? 'My Brands' : 'Brandurile Mele'}</option>
                        {ownBrands.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <select value={filterCompBrand} onChange={e => setFilterCompBrand(e.target.value)}
                        style={{ flexShrink: 0, minWidth: '120px', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(0,0,0,0.2)' : '#f9fafb', color: colors.text, fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
                        <option value="">{lang === 'en' ? 'Competitors' : 'Concurenți'}</option>
                        {compBrands.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    {(search || filterCity || filterOwnBrand || filterCompBrand || selectedCategory) && (
                        <button onClick={() => { setSearch(''); setFilterCity(''); setFilterCompBrand(''); setFilterOwnBrand(''); setSelectedCategory('') }}
                            style={{ flexShrink: 0, padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                            Reset
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: colors.textSecondary }}>Se procesează datele din Supabase...</div>
            ) : (
                <>
                    {/* KPIs */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                        {[
                            { title: lang === 'en' ? 'Average Price Difference' : 'Diferență Medie Preț', val: `${avgDiff > 0 ? '+' : ''}${avgDiff.toFixed(1)}%`, sub: lang === 'en' ? 'vs selected competition' : 'vs concurența selectată', color: avgDiff <= 0 ? '#10B981' : '#EF4444' },
                            { title: lang === 'en' ? 'Competitive Category' : 'Categorie Competitivă', val: realData[0]?.category || 'Sushi', sub: lang === 'en' ? 'Auto extracted from period' : 'Extragere automată din perioadă', color: '#6366F1' },
                            { title: lang === 'en' ? 'Price Index' : 'Index Preț', val: (100 + avgDiff).toFixed(1), sub: lang === 'en' ? 'Below market average (100)' : 'Sub media pieței (100)', color: '#F59E0B' },
                            { title: lang === 'en' ? 'Analyzed Products' : 'Produse Analizate', val: realData.length.toString(), sub: lang === 'en' ? 'From competitors menu' : 'Din meniul concurenței', color: '#8B5CF6' },
                            { title: lang === 'en' ? 'Cities' : 'Orașe', val: Object.keys(byCityData).length.toString(), sub: lang === 'en' ? 'With available data' : 'Cu date disponibile', color: '#EC4899' },
                        ].map((kpi, i) => (
                            <div key={i} style={{ background: isDark ? 'rgba(30,30,32,0.6)' : '#fff', borderRadius: '16px', padding: '20px', border: `1px solid ${colors.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ fontSize: '13px', fontWeight: '600', color: colors.textSecondary }}>{kpi.title}</div>
                                <div style={{ fontSize: '28px', fontWeight: '800', color: kpi.color, textShadow: isDark ? `0 0 20px ${kpi.color}40` : 'none' }}>{kpi.val}</div>
                                <div style={{ fontSize: '12px', color: colors.textSecondary, opacity: 0.8 }}>{kpi.sub}</div>
                            </div>
                        ))}
                    </div>

                    {/* SOPHISTICATED CHARTS ROW */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                        {/* Scatter Plot: Value for Money */}
                        <div style={{ background: isDark ? 'rgba(30,30,32,0.6)' : '#fff', borderRadius: '16px', border: `1px solid ${colors.border}`, padding: '24px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ marginBottom: '16px' }}>
                                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '700', color: colors.text }}>Value for Money (Preț vs Gramaj)</h3>
                                <p style={{ margin: 0, fontSize: '12px', color: colors.textSecondary }}>Produsele din stânga jos sunt ieftine dar mici. Cele din dreapta jos sunt <strong style={{color:'#10B981'}}>Best Value</strong>.</p>
                            </div>
                            {scatterMarketData.length > 0 ? (
                            <div style={{ flex: 1, minHeight: 280 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} />
                                        <XAxis dataKey="weight" type="number" name="Gramaj" unit="g" domain={['auto', 'auto']} tick={{ fill: colors.textSecondary, fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis dataKey="price" type="number" name="Preț" unit="lei" domain={['auto', 'auto']} tick={{ fill: colors.textSecondary, fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value, name) => [`${value}`, name]} labelFormatter={() => ''} content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const d = payload[0].payload;
                                                return (
                                                    <div style={{ background: isDark ? '#2c2c2e' : '#fff', border: `1px solid ${colors.border}`, padding: '10px', borderRadius: '8px' }}>
                                                        <div style={{ fontSize: '12px', fontWeight: '700', color: colors.text }}>{d.name}</div>
                                                        <div style={{ fontSize: '11px', color: colors.textSecondary, marginBottom: '4px' }}>{d.brand}</div>
                                                        <div style={{ fontSize: '12px', color: d.fill, fontWeight: '800' }}>{d.price} lei / {d.weight}g</div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }} />
                                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                        <Scatter name="Piață" data={scatterMarketData.filter(d => d.type === 'Piață')} fill="#6366F1" />
                                        <Scatter name="Noi" data={scatterMarketData.filter(d => d.type === 'Noi')} fill="#EF4444" shape="star" />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                            ) : <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary, fontSize: 13 }}>Nu sunt suficiente date de gramaj extrase.</div>}
                        </div>

                        {/* Trend Line: Price Index Evolution */}
                        <div style={{ background: isDark ? 'rgba(30,30,32,0.6)' : '#fff', borderRadius: '16px', border: `1px solid ${colors.border}`, padding: '24px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ marginBottom: '16px' }}>
                                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '700', color: colors.text }}>Evoluție Index Preț (Trend Piață)</h3>
                                <p style={{ margin: 0, fontSize: '12px', color: colors.textSecondary }}>Linia albastră reprezintă media pieței. Cea roșie poziția brandului tău față de ea.</p>
                            </div>
                            {trendData.length > 0 ? (
                            <div style={{ flex: 1, minHeight: 280 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={trendData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} vertical={false} />
                                        <XAxis dataKey="date" tick={{ fill: colors.textSecondary, fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis domain={['auto', 'auto']} tick={{ fill: colors.textSecondary, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                                        <Tooltip contentStyle={{ background: isDark ? '#2c2c2e' : '#fff', border: `1px solid ${colors.border}`, borderRadius: '8px', fontSize: '12px' }} />
                                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                        <ReferenceLine y={100} stroke="#6366F1" strokeDasharray="3 3" label={{ position: 'top', value: 'Echilibru Piață', fill: '#6366F1', fontSize: 10 }} />
                                        <Line type="monotone" name="Media Pieței" dataKey="IndexConcurenta" stroke="#6366F1" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                                        <Line type="monotone" name="Media Ta (Index)" dataKey="IndexNoi" stroke="#EF4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                            ) : <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary, fontSize: 13 }}>Nu există istoric salvat.</div>}
                        </div>
                    </div>

                    {/* Smart Min/Avg/Max Chart */}
                    <div style={{ background: isDark ? 'rgba(30,30,32,0.6)' : '#fff', borderRadius: '16px', border: `1px solid ${colors.border}`, padding: '24px', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                            <div>
                                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '700', color: colors.text }}>📊 {lang === 'en' ? 'Market Prices: Min / Avg / Max vs Us' : 'Prețuri Piață: Min / Mediu / Max vs Noi'}</h3>
                                <p style={{ margin: 0, fontSize: '12px', color: colors.textSecondary }}>{lang === 'en' ? 'Each category shows competitor price range vs your average (red bar).' : 'Fiecare categorie arată intervalul de preț competitor comparat cu media voastră (bara roșie).'}</p>
                            </div>
                            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                {[['#94A3B8', 'Min Piață'], ['#6366F1', 'Mediu Piață'], ['#1E3A5F', 'Max Piață'], ['#EF4444', 'Noi (avg)']].map(([c, l]) => (
                                    <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{ width: 12, height: 12, borderRadius: '3px', background: c }} />
                                        <span style={{ fontSize: '12px', color: colors.textSecondary }}>{l}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {minAvgMaxChart.length === 0 ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: colors.textSecondary, fontSize: '14px' }}>Nu există suficiente date cu prețuri comparate. Asigurați-vă că produsele proprii sunt încărcate.</div>
                        ) : (
                            <div style={{ height: 420 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={minAvgMaxChart} margin={{ top: 24, right: 32, left: 0, bottom: 60 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} vertical={false} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false}
                                            tick={{ fill: colors.textSecondary, fontSize: 11 }}
                                            angle={-35} textAnchor="end" interval={0} height={70} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: colors.textSecondary, fontSize: 11 }}
                                            tickFormatter={v => `${v} lei`} width={70} />
                                        <Tooltip
                                            contentStyle={{ background: isDark ? '#1e1e20' : '#fff', border: `1px solid ${colors.border}`, borderRadius: '12px', fontSize: '13px' }}
                                            formatter={(value, name) => [`${value} lei`, name]}
                                            labelFormatter={(label, payload) => {
                                                const d = payload?.[0]?.payload
                                                return d ? `${d.fullName} (${d.count} produse)` : label
                                            }}
                                        />
                                        {/* Min bar — very light */}
                                        <Bar dataKey="min" name="Min Piață" fill="#CBD5E1" radius={[4,4,0,0]} maxBarSize={32}>
                                            <LabelList dataKey="min" position="top" fill={colors.textSecondary} fontSize={10} formatter={v => `${v}`} />
                                        </Bar>
                                        {/* Avg bar — medium */}
                                        <Bar dataKey="avg" name="Mediu Piață" fill="#6366F1" radius={[4,4,0,0]} maxBarSize={32}>
                                            <LabelList dataKey="avg" position="top" fill={'#6366F1'} fontSize={10} fontWeight="700" formatter={v => `${v}`} />
                                        </Bar>
                                        {/* Max bar — dark */}
                                        <Bar dataKey="max" name="Max Piață" fill="#1e3a5f" radius={[4,4,0,0]} maxBarSize={32}>
                                            <LabelList dataKey="max" position="top" fill={colors.textSecondary} fontSize={10} formatter={v => `${v}`} />
                                        </Bar>
                                        
                                        {/* Our price — GLOBAL or local average RED BAR */}
                                        <Bar dataKey="ourAvg" name="Noi (avg)" fill="#EF4444" radius={[4,4,0,0]} maxBarSize={32}>
                                            <LabelList dataKey="ourAvg" position="top" fill="#EF4444" fontSize={10} fontWeight="700" formatter={v => v ? `${v}` : ''} />
                                        </Bar>
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    {/* Additional charts: Category diff + Competitor diff */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                        <div style={{ background: isDark ? 'rgba(30,30,32,0.6)' : '#fff', borderRadius: '16px', border: `1px solid ${colors.border}`, padding: '24px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ marginBottom: '20px' }}>
                                <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '600', color: colors.text }}>Diferență Preț per Categorie (%)</h3>
                                <p style={{ margin: 0, fontSize: '12px', color: colors.textSecondary, lineHeight: '1.4' }}>
                                    Arată cu cât sunt categoriile concurenței mai scumpe sau mai ieftine.<br/>
                                    <span style={{ color: '#F43F5E', fontWeight: 'bold' }}>+ (Bara la dreapta):</span> Piața este mai SCUMPĂ decât tine.<br/>
                                    <span style={{ color: '#10B981', fontWeight: 'bold' }}>- (Bara la stânga):</span> Piața este mai IEFTINĂ decât tine.
                                </p>
                            </div>
                            <div style={{ flex: 1, minHeight: 250 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={catAnalysis} margin={{ top: 20, right: 30, left: 10, bottom: 0 }} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} />
                                        <XAxis type="number" tickFormatter={v => `${v > 0 ? '+' : ''}${v}%`} tick={{ fill: colors.textSecondary, fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis dataKey="name" type="category" tick={{ fill: colors.textSecondary, fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
                                        <Tooltip formatter={val => [`${Number(val) > 0 ? '+' : ''}${val}%`, 'Diferență vs Noi']} contentStyle={{ background: isDark ? '#2c2c2e' : '#fff', border: `1px solid ${colors.border}`, borderRadius: '8px' }} />
                                        <Bar dataKey="diffPercent" radius={[0,4,4,0]} maxBarSize={20}>
                                            {catAnalysis.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.diffPercent > 0 ? '#F43F5E' : '#10B981'} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div style={{ background: isDark ? 'rgba(30,30,32,0.6)' : '#fff', borderRadius: '16px', border: `1px solid ${colors.border}`, padding: '24px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ marginBottom: '20px' }}>
                                <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '600', color: colors.text }}>Tipar Concurenți direcți vs Noi (%)</h3>
                                <p style={{ margin: 0, fontSize: '12px', color: colors.textSecondary, lineHeight: '1.4' }}>
                                    Cine vinde mai scump și cine mai ieftin raportat la brandul tău.<br/>
                                    <span style={{ color: '#F43F5E', fontWeight: 'bold' }}>+ (Bara la dreapta):</span> Adversarul vinde mai SCUMP.<br/>
                                    <span style={{ color: '#10B981', fontWeight: 'bold' }}>- (Bara la stânga):</span> Adversarul vinde mai IEFTIN.
                                </p>
                            </div>
                            <div style={{ flex: 1, minHeight: 250 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={compAnalysis} margin={{ top: 10, right: 30, left: 10, bottom: 0 }} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} />
                                        <XAxis type="number" tickFormatter={v => `${v > 0 ? '+' : ''}${v}%`} tick={{ fill: colors.textSecondary, fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis dataKey="name" type="category" tick={{ fill: colors.textSecondary, fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
                                        <Tooltip formatter={val => [`${Number(val) > 0 ? '+' : ''}${val}%`, 'Diferență']} contentStyle={{ background: isDark ? '#2c2c2e' : '#fff', border: `1px solid ${colors.border}`, borderRadius: '8px' }} />
                                        <Bar dataKey="diffPercent" radius={[0,4,4,0]} maxBarSize={20}>
                                            {compAnalysis.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.diffPercent > 0 ? '#F43F5E' : '#10B981'} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* City-grouped tables */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {Object.entries(byCityData).map(([city, cityRows]) => {
                            const isCollapsed = collapsedCities[city]
                            const matched = cityRows.filter(r => r.hasExactMatch && r.ournPrice > 0)
                            const cityAvgDiff = matched.length && matched.reduce((s, r) => s + r.compPrice, 0) > 0
                                ? ((matched.reduce((s, r) => s + (r.ournPrice - r.compPrice), 0) / matched.reduce((s, r) => s + r.compPrice, 0)) * 100).toFixed(1)
                                : null
                            return (
                                <div key={city} style={{ background: isDark ? 'rgba(30,30,32,0.6)' : '#fff', borderRadius: '16px', border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
                                    <div onClick={() => toggleCity(city)} style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', userSelect: 'none', background: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb', borderBottom: isCollapsed ? 'none' : `1px solid ${colors.border}` }}>
                                        <span style={{ fontSize: '20px' }}>{CITY_FLAGS[city] || '📍'}</span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '16px', fontWeight: '800', color: colors.text }}>{city}</div>
                                            <div style={{ display: 'flex', gap: '12px', marginTop: '3px', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '12px', color: colors.textSecondary, fontWeight: '600' }}>{cityRows.length} produse</span>
                                                {cityAvgDiff !== null && (
                                                    <span style={{ fontSize: '12px', fontWeight: '700', color: Number(cityAvgDiff) <= 0 ? '#10B981' : '#EF4444' }}>
                                                        Diferență medie: {Number(cityAvgDiff) > 0 ? '+' : ''}{cityAvgDiff}%
                                                    </span>
                                                )}
                                                <span style={{ fontSize: '12px', color: colors.textSecondary }}>{matched.length} cu preț comparat</span>
                                            </div>
                                        </div>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.2s', color: colors.textSecondary }}>
                                            <polyline points="6 9 12 15 18 9" />
                                        </svg>
                                    </div>
                                    {!isCollapsed && (
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                                <thead>
                                                    <tr style={{ background: isDark ? 'rgba(0,0,0,0.2)' : '#f9fafb' }}>
                                                        {['Actualizare', 'Produs', 'Gramaj', 'Bucăți', 'Brandul Nostru', 'Concurent', 'Diferență'].map(h => (
                                                            <th key={h} style={{ padding: '12px 20px', fontSize: '11px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {cityRows.slice(0, PREVIEW_ROWS).map((row, i) => {
                                                        const diff = row.hasExactMatch ? row.ournPrice - row.compPrice : null
                                                        const isCheaper = diff !== null && diff <= 0
                                                        return (
                                                            <tr key={i} style={{ borderBottom: `1px solid ${colors.border}` }}>
                                                                <td style={{ padding: '14px 20px', color: colors.textSecondary, fontSize: '12px' }}>
                                                                    {row.snapshot_date}
                                                                    <div style={{ marginTop: '4px' }}>
                                                                        <span style={{ fontSize: '10px', textTransform: 'capitalize', background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{row.platform}</span>
                                                                    </div>
                                                                </td>
                                                                <td style={{ padding: '14px 20px' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                        <div onClick={() => setSelectedProduct(row)} style={{ cursor: 'pointer', flexShrink: 0 }}>
                                                                            {row.image_url ? (
                                                                                <img src={row.image_url} alt={row.name} style={{ width: 40, height: 40, borderRadius: '8px', objectFit: 'cover' }} />
                                                                            ) : (
                                                                                <div style={{ width: 40, height: 40, borderRadius: '8px', background: 'linear-gradient(135deg,#f1f5f9,#e2e8f0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🍽️</div>
                                                                            )}
                                                                        </div>
                                                                        <div>
                                                                            <div onClick={() => setSelectedProduct(row)} style={{ color: colors.text, fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}
                                                                                onMouseOver={e => e.currentTarget.style.color = '#6366F1'}
                                                                                onMouseOut={e => e.currentTarget.style.color = colors.text}>
                                                                                {row.name}
                                                                            </div>
                                                                            <div style={{ color: colors.textSecondary, fontSize: '11px', marginTop: '2px' }}>{row.category}</div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td style={{ padding: '14px 20px', color: colors.textSecondary, fontSize: '13px' }}>
                                                                    {row.weight !== '—' ? <span style={{ background: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9', padding: '3px 6px', borderRadius: '4px', fontWeight: '600' }}>{row.weight}</span> : '—'}
                                                                </td>
                                                                <td style={{ padding: '14px 20px', color: colors.textSecondary, fontSize: '13px' }}>
                                                                    <span style={{ background: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9', padding: '3px 6px', borderRadius: '4px', fontWeight: '600' }}>{row.pieces}</span>
                                                                </td>
                                                                <td style={{ padding: '14px 20px', color: '#6366F1', fontWeight: '800', fontSize: '14px' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                        {row.ourLogo && <img src={row.ourLogo} alt={row.ourBrand} style={{ width: 22, height: 22, borderRadius: '4px', objectFit: 'cover' }} />}
                                                                        <div>
                                                                            {row.hasExactMatch ? `${row.ournPrice} lei` : <span style={{ color: colors.textSecondary, fontSize: '12px' }}>—</span>}
                                                                            <div style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: 'normal' }}>{row.ourBrand}</div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td style={{ padding: '14px 20px' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                        {row.compLogo && <img src={row.compLogo} alt={row.compBrand} style={{ width: 22, height: 22, borderRadius: '4px', objectFit: 'cover' }} />}
                                                                        <div>
                                                                            <div style={{ color: colors.text, fontSize: '14px', fontWeight: '700' }}>
                                                                                {row.isOwnOnly ? '—' : `${row.compPrice} lei`}
                                                                            </div>
                                                                            <div style={{ color: colors.textSecondary, fontSize: '11px' }}>{row.compBrand}</div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td style={{ padding: '14px 20px' }}>
                                                                    {row.isOwnOnly ? (
                                                                         <span style={{ color: '#10B981', background: isDark ? 'rgba(16,185,129,0.1)' : '#ecfdf5', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '700' }}>Dominăm piața</span>
                                                                    ) : diff !== null ? (
                                                                        <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', background: isCheaper ? (isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5') : (isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2'), color: isCheaper ? '#10B981' : '#ef4444' }}>
                                                                            {diff > 0 ? '+' : ''}{Number(diff).toFixed(1)} lei ({((diff / row.compPrice) * 100).toFixed(1)}%)
                                                                        </span>
                                                                    ) : (
                                                                        <span style={{ color: colors.textSecondary, fontSize: '12px' }}>Nu avem</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                            {cityRows.length > PREVIEW_ROWS && (
                                                <div style={{ padding: '16px 24px', borderTop: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isDark ? 'rgba(99,102,241,0.05)' : '#f8f7ff' }}>
                                                    <span style={{ fontSize: '13px', color: colors.textSecondary }}>
                                                        Se afișează <strong style={{ color: colors.text }}>10</strong> din <strong style={{ color: colors.text }}>{cityRows.length}</strong> produse
                                                    </span>
                                                    <button
                                                        onClick={() => navigate(`/marketing-analytics/${encodeURIComponent(city)}`)}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}
                                                        onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)' }}
                                                        onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)' }}
                                                    >
                                                        → Vezi toate {cityRows.length} produse din {city}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </>
            )}

            {/* Modal for Product Details */}
            {selectedProduct && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setSelectedProduct(null)}></div>
                    <div style={{ position: 'relative', width: '100%', maxWidth: '500px', background: isDark ? '#1e1e20' : '#ffffff', borderRadius: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
                        {selectedProduct.image_url && (
                            <div style={{ position: 'relative', width: '100%', height: '240px', background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }}>
                                <img src={selectedProduct.image_url} alt={selectedProduct.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.6) 100%)' }}></div>
                            </div>
                        )}
                        <button onClick={() => setSelectedProduct(null)} style={{ position: 'absolute', top: '16px', right: '16px', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,0,0,0.4)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, backdropFilter: 'blur(4px)' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                        <div style={{ padding: '24px' }}>
                            <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '800', color: colors.text }}>{selectedProduct.name}</h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                                <span style={{ fontSize: '12px', background: '#6366F1', color: '#fff', padding: '3px 8px', borderRadius: '12px', fontWeight: '600' }}>{selectedProduct.category}</span>
                                {selectedProduct.weight !== '—' && <span style={{ fontSize: '12px', background: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9', color: colors.textSecondary, padding: '3px 8px', borderRadius: '12px', fontWeight: '600' }}>{selectedProduct.weight}</span>}
                                {selectedProduct.pieces !== '—' && <span style={{ fontSize: '12px', background: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9', color: colors.textSecondary, padding: '3px 8px', borderRadius: '12px', fontWeight: '600' }}>{selectedProduct.pieces} {lang==='en'?'pieces':'bucăți'}</span>}
                                {selectedProduct.platform && <span style={{ fontSize: '12px', border: `1px solid ${colors.border}`, color: colors.textSecondary, padding: '3px 8px', borderRadius: '12px', fontWeight: '600', textTransform: 'capitalize' }}>Platformă: {selectedProduct.platform}</span>}
                            </div>
                            {selectedProduct.description && <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: colors.textSecondary, lineHeight: '1.5' }}>{selectedProduct.description}</p>}
                            <div style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb', border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '16px' }}>
                                <div style={{ fontSize: '12px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Comparație Prețuri</div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        {selectedProduct.ourLogo ? <img src={selectedProduct.ourLogo} alt="Our" style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'cover' }} /> : <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>Noi</div>}
                                        <div>
                                            <div style={{ fontSize: '12px', color: colors.textSecondary }}>{selectedProduct.ourBrand}</div>
                                            <div style={{ fontSize: '16px', fontWeight: '800', color: '#6366F1' }}>{selectedProduct.ournPrice} lei</div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '2px' }}>Diferență</div>
                                        <div style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', background: (selectedProduct.ournPrice - selectedProduct.compPrice) <= 0 ? (isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5') : (isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2'), color: (selectedProduct.ournPrice - selectedProduct.compPrice) <= 0 ? '#10B981' : '#ef4444' }}>
                                            {Number(selectedProduct.ournPrice - selectedProduct.compPrice) > 0 ? '+' : ''}{Number(selectedProduct.ournPrice - selectedProduct.compPrice).toFixed(1)} lei
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', direction: 'rtl' }}>
                                        {selectedProduct.compLogo ? <img src={selectedProduct.compLogo} alt="Comp" style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'cover' }} /> : <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary, fontSize: '14px', fontWeight: 'bold' }}>Ei</div>}
                                        <div style={{ direction: 'ltr', textAlign: 'right' }}>
                                            <div style={{ fontSize: '12px', color: colors.textSecondary }}>{selectedProduct.compBrand}</div>
                                            <div style={{ fontSize: '16px', fontWeight: '800', color: colors.text }}>{selectedProduct.compPrice} lei</div>
                                        </div>
                                    </div>
                                </div>
                                {selectedProduct.compUrl && (
                                    <a href={selectedProduct.compUrl} target="_blank" rel="noopener noreferrer"
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '12px', background: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff', border: `1px solid ${colors.border}`, borderRadius: '12px', color: colors.text, textDecoration: 'none', fontSize: '13px', fontWeight: '600' }}
                                        onMouseOver={e => { e.currentTarget.style.borderColor = '#6366F1'; e.currentTarget.style.color = '#6366F1' }}
                                        onMouseOut={e => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.color = colors.text }}>
                                        Deschide pagina restaurantului
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
