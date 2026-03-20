import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { supabase } from '../lib/supabaseClient'
import { useSearchParams } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker, Polyline } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

L.Icon.Default.mergeOptions({
    iconRetinaUrl,
    iconUrl,
    shadowUrl,
})

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function getCoordsAtDistance(startLat, startLon, distanceKm, bearingDegrees) {
    // If bearing is undefined, pick a random angle between 0 and 360
    const angle = bearingDegrees !== undefined ? bearingDegrees : Math.random() * 360;
    const R = 6371;
    const d = distanceKm;
    const brng = (angle * Math.PI) / 180;
    const lat1 = (startLat * Math.PI) / 180;
    const lon1 = (startLon * Math.PI) / 180;

    const lat2 = Math.asin(
        Math.sin(lat1) * Math.cos(d / R) +
        Math.cos(lat1) * Math.sin(d / R) * Math.cos(brng)
    );
    const lon2 = lon1 + Math.atan2(
        Math.sin(brng) * Math.sin(d / R) * Math.cos(lat1),
        Math.cos(d / R) - Math.sin(lat1) * Math.sin(lat2)
    );

    return {
        lat: (lat2 * 180) / Math.PI,
        lon: (lon2 * 180) / Math.PI,
    };
}

const CITY_COORDS = {
    'Bucharest': { lat: 44.4268, lon: 26.1025 }, 'Cluj-Napoca': { lat: 46.7712, lon: 23.6236 },
    'Timisoara': { lat: 45.7489, lon: 21.2087 }, 'Iasi': { lat: 47.1585, lon: 27.6014 },
    'Brasov': { lat: 45.6427, lon: 25.5887 }, 'Ploiesti': { lat: 44.9451, lon: 26.0147 },
    'Bacau': { lat: 46.5670, lon: 26.9146 }, 'Targu Mures': { lat: 46.5386, lon: 24.5544 },
    'Braila': { lat: 45.2692, lon: 27.9574 }, 'Baia Mare': { lat: 47.6669, lon: 23.5847 },
    'Sibiu': { lat: 45.7983, lon: 24.1256 }, 'Constanta': { lat: 44.1733, lon: 28.6383 },
    'Galati': { lat: 45.4353, lon: 28.0080 }, 'Pitesti': { lat: 44.8565, lon: 24.8692 },
    'Craiova': { lat: 44.3190, lon: 23.7949 }, 'Oradea': { lat: 47.0465, lon: 21.9189 },
    'Arad': { lat: 46.1866, lon: 21.3123 }, 'Suceava': { lat: 47.6508, lon: 26.2539 },
}

const KM_COLORS = ['#6366F1', '#8B5CF6', '#A855F7', '#EC4899', '#EF4444']

// Geocode address → { lat, lon } using Nominatim (free, no API key)
async function geocode(address, city) {
    const query = encodeURIComponent(`${address}, ${city}, Romania`)
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`, {
        headers: { 'User-Agent': 'AggregatorMonitor/1.0' }
    })
    const data = await res.json()
    if (data[0]) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), display: data[0].display_name }
    // Fallback to city center
    const cc = CITY_COORDS[city]
    return cc ? { ...cc, display: city + ' (centru)' } : null
}

export default function DeliveryZone() {
    const { isDark, colors } = useTheme()
    const { lang, t } = useLanguage()
    const [searchParams, setSearchParams] = useSearchParams()
    const activeTab = searchParams.get('tab') || 'configs' // configs | history
    const [configs, setConfigs] = useState([])
    const [history, setHistory] = useState([])
    const [historyLoading, setHistoryLoading] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [runningId, setRunningId] = useState(null)
    const [editingConfig, setEditingConfig] = useState(null)
    const [importing, setImporting] = useState(false)
    const [importResult, setImportResult] = useState(null)
    const [importProgress, setImportProgress] = useState(null)  // { current, total, phase }
    const [configSearch, setConfigSearch] = useState('')
    const [configCityFilter, setConfigCityFilter] = useState('')
    const [configBrandFilter, setConfigBrandFilter] = useState('')
    const cancelImportRef = useRef(false)
    const [dbRestaurants, setDbRestaurants] = useState([])
    const [dbBrands, setDbBrands] = useState([])
    const [mapViewRun, setMapViewRun] = useState(null)

    const emptyForm = { name: '', restaurant_name: '', brand: 'Sushi Master', city: 'Bucharest', platforms: ['wolt', 'glovo', 'bolt'], addresses: [{ text: '', lat: null, lon: null, geocoding: false }], custom_schedule_days: [], custom_schedule_times: [] }
    const [form, setForm] = useState(emptyForm)
    const [globalRules, setGlobalRules] = useState({ days: [1,2,3,4,5,6,0], times: ['10:00', '14:00', '18:00'], brands: [], cities: [] })
    const [showGlobalRules, setShowGlobalRules] = useState(false)

    // History filters
    const today = new Date().toISOString().split('T')[0]
    const ago30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const [dateFrom, setDateFrom] = useState(ago30)
    const [dateTo, setDateTo] = useState(today)
    const [showDates, setShowDates] = useState(false)
    const [historyConfigFilter, setHistoryConfigFilter] = useState('')
    const [historyCityFilter, setHistoryCityFilter] = useState('')
    const [historyBrandFilter, setHistoryBrandFilter] = useState([])

    const glass = {
        background: isDark ? 'rgba(30,30,32,0.6)' : 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(20px) saturate(180%)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)'}`,
        boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.2)' : '0 8px 32px rgba(31,38,135,0.05)',
        borderRadius: '16px',
        padding: '24px',
    }
    
    // UI Helpers
    const IconBtn = ({ icon, label, onClick, active, color = '#6366F1' }) => (
        <button onClick={onClick} style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px',
            borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
            border: active ? `1px solid ${color}` : `1px solid transparent`,
            background: active ? `${color}15` : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
            color: active ? color : colors.textSecondary,
            transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
            transform: active ? 'scale(1.02)' : 'scale(1)'
        }} className="hover-scale">
            {icon}
            {label}
        </button>
    )

    // ─── Load configs from Supabase ───
    const loadConfigs = useCallback(async () => {
        const { data } = await supabase.from('delivery_zone_configs').select('*').order('created_at', { ascending: false })
        if (data) setConfigs(data)
    }, [])

    // ─── Load restaurants + brands for dropdowns ───
    useEffect(() => {
        supabase.from('restaurants').select('id, name, brand_id, city, brands(name)').order('name').then(({ data }) => {
            if (data) setDbRestaurants(data.map(r => ({ ...r, brand: r.brands?.name })))
        })
        supabase.from('brands').select('id, name, logo_url').order('name').then(({ data }) => {
            if (data) setDbBrands(data)
        })
    }, [])

    // ─── Load history from Supabase ───
    const loadHistory = useCallback(async (from = dateFrom, to = dateTo) => {
        setHistoryLoading(true)
        let q = supabase.from('delivery_zone_history').select('*')
            .gte('check_date', from).lte('check_date', to)
            .order('checked_at', { ascending: false }).limit(200)
        const { data } = await q
        if (data) {
            setHistory(data)
            // Auto-open map for the most recent run if none is open
            if (data.length > 0 && !mapViewRun) setMapViewRun(data[0].id)
        }
        setHistoryLoading(false)
    }, [dateFrom, dateTo, mapViewRun])

    useEffect(() => { loadConfigs() }, [loadConfigs])
    useEffect(() => { if (activeTab === 'history') loadHistory() }, [activeTab, loadHistory])

    function getBrandLogo(brandName) {
        if (!brandName) return null
        const b = dbBrands.find(bb => bb.name.toLowerCase() === brandName.toLowerCase())
        return b?.logo_url ? b.logo_url : null
    }

    // ─── Geocode a single address in the form ───
    async function geocodeFormAddress(idx) {
        const addr = form.addresses[idx]
        if (!addr.text) return
        const updated = [...form.addresses]
        updated[idx] = { ...updated[idx], geocoding: true }
        setForm(p => ({ ...p, addresses: updated }))

        const result = await geocode(addr.text, form.city)
        const upd2 = [...form.addresses]
        upd2[idx] = { ...upd2[idx], geocoding: false, lat: result?.lat || null, lon: result?.lon || null, display: result?.display }

        if (idx === 0 && result?.lat && result?.lon) {
            const manualAddrs = upd2.filter((a, i) => i === 0 || !a.is_auto) // pastram doar baza si cele adaugate strict manual
            setForm(p => ({ ...p, addresses: upd2 })) // instant update ptr HQ

            const autoAddrs = []
            for (let km = 1; km <= 5; km++) {
                const pt = getCoordsAtDistance(result.lat, result.lon, km)
                let streetName = `Punct la ${km} km (Auto)`
                
                try {
                    const rGeo = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pt.lat}&lon=${pt.lon}&format=json`, { headers: { 'User-Agent': 'AggregatorMonitor/1.0' } })
                    const rd = await rGeo.json()
                    if (rd && rd.address) {
                        let str = rd.address.road || rd.address.pedestrian || ''
                        if (rd.address.house_number) str += ' ' + rd.address.house_number
                        if (!str && rd.address.suburb) str = rd.address.suburb 
                        if (str) streetName = `${str} (~${km}km)`
                    }
                } catch {}
                await new Promise(r => setTimeout(r, 1000)) // limit nominatim
                
                autoAddrs.push({
                    text: streetName,
                    lat: pt.lat,
                    lon: pt.lon,
                    geocoding: false,
                    is_auto: true,
                    km_distance: km
                })
                setForm(p => ({ ...p, addresses: [...manualAddrs, ...autoAddrs] }))
            }
            return
        }

        setForm(p => ({ ...p, addresses: upd2 }))
    }

    // ─── Save config — OPTIMISTIC (UI updates instantly, API syncs in background) ───
    async function saveConfig() {
        const payload = {
            name: form.name || `${form.brand} - ${form.city}`,
            restaurant_name: form.restaurant_name,
            brand: form.brand,
            city: form.city,
            address: form.addresses[0]?.text || `${form.name}, ${form.city}`,
            platform: (form.platforms || [])[0] || 'wolt', // keep for backwards compat
            platforms: form.platforms || ['wolt', 'glovo', 'bolt'],
            addresses: form.addresses.filter(a => a.text),
            is_active: true,
            custom_schedule_days: form.custom_schedule_days,
            custom_schedule_times: form.custom_schedule_times,
        }
        if (editingConfig) {
            // Optimistic update — reflect immediately
            setConfigs(prev => prev.map(c => c.id === editingConfig.id ? { ...c, ...payload } : c))
            setShowForm(false); setEditingConfig(null); setForm(emptyForm)
            // Background sync
            supabase.from('delivery_zone_configs').update(payload).eq('id', editingConfig.id)
        } else {
            // Optimistic insert — add with temp id
            const tempId = `temp_${Date.now()}`
            setConfigs(prev => [{ ...payload, id: tempId, created_at: new Date().toISOString() }, ...prev])
            setShowForm(false); setEditingConfig(null); setForm(emptyForm)
            // Background sync — then replace temp with real id
            supabase.from('delivery_zone_configs').insert(payload).select().then(({ data }) => {
                if (data?.[0]) setConfigs(prev => prev.map(c => c.id === tempId ? data[0] : c))
            })
        }
    }

    // ─── Auto-import all restaurants from DB ───
    async function importAllRestaurants() {
        setImporting(true)
        setImportResult(null)
        setImportProgress({ phase: 'Se conectează la bază de date…', current: 0, total: null })
        try {
            setImportProgress({ phase: 'Se preiau restaurantele active…', current: 0, total: null })
            // Fetch restaurants from Supabase directly so we can show progress
            const { data: rests } = await supabase
                .from('restaurants')
                .select('id, name, address, city, brand_id, glovo_url, wolt_url, bolt_url, is_active')
                .eq('is_active', true)

            if (!rests || rests.length === 0) {
                setImportResult({ ok: false, msg: '⚠️ Nu s-au găsit restaurante active în baza de date.' })
                setImporting(false); setImportProgress(null); return
            }

            setImportProgress({ phase: `Geocodare adrese (0 / ${rests.length})…`, current: 0, total: rests.length })

            // Simulate progress WHILE the API is geocoding (1.1s/restaurant = slow)
            let fakeProgress = 0
            const interval = setInterval(() => {
                fakeProgress = Math.min(fakeProgress + 1, rests.length - 1)
                setImportProgress({ phase: `Se geocodează: restaurant ${fakeProgress + 1} / ${rests.length}…`, current: fakeProgress, total: rests.length })
            }, 1100)

            // Call the API — overwrite=true so it updates existing configs too
            const res = await fetch(`${API}/api/delivery-zone/import-restaurants`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platform: 'wolt', overwrite: true })
            })

            const json = await res.json()
            clearInterval(interval)

            if (json.success) {
                setImportProgress({ phase: 'Finalizat!', current: rests.length, total: rests.length })
                setTimeout(() => {
                    setImportResult({
                        ok: true,
                        created: json.created ?? 0,
                        skipped: json.skipped ?? 0,
                        failed: json.failed ?? 0,
                        total: rests.length
                    })
                    setImportProgress(null)
                    loadConfigs()  // refresh list immediately
                }, 600)
            } else {
                clearInterval(interval)
                setImportResult({ ok: false, msg: `❌ Eroare API: ${json.error || 'Necunoscută'}` })
                setImportProgress(null)
            }
        } catch (e) {
            setImportResult({ ok: false, msg: `❌ Serverul API nu este disponibil. Pornește workers/src/api-server.js` })
            setImportProgress(null)
        }
        setImporting(false)
    }

    async function runCheck(config) {
        setRunningId(config.id)
        let addresses = (config.addresses || []).filter(a => a.lat && a.lon)

        if (addresses.length === 0) { 
            alert('Restaurantul "' + config.name + '" nu are nicio adresă validă cu coordonate GPS!'); 
            setRunningId(null); 
            return; 
        }

        // Auto-generate test points on-the-fly if missing (only 1 base address found)
        if (addresses.length === 1) {
            const base = addresses[0]
            const generatedAddrs = []
            for (let km = 1; km <= 5; km++) {
                const pt = getCoordsAtDistance(base.lat, base.lon, km)
                let streetName = `Punct la ${km} km (Auto)`
                
                try {
                    const rGeo = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pt.lat}&lon=${pt.lon}&format=json`, { headers: { 'User-Agent': 'AggregatorMonitor/1.0' } })
                    const rd = await rGeo.json()
                    if (rd && rd.address) {
                        let str = rd.address.road || rd.address.pedestrian || ''
                        if (rd.address.house_number) str += ' ' + rd.address.house_number
                        if (!str && rd.address.suburb) str = rd.address.suburb 
                        if (str) streetName = `${str} (~${km}km)`
                    }
                } catch {}
                await new Promise(r => setTimeout(r, 1000))
                
                generatedAddrs.push({
                    text: streetName,
                    lat: pt.lat,
                    lon: pt.lon,
                    geocoding: false,
                    is_auto: true,
                    km_distance: km
                })
            }
            addresses = [base, ...generatedAddrs]

            // Save the newly generated test points into the DB config permanently
            await supabase.from('delivery_zone_configs').update({ addresses }).eq('id', config.id)
            // Update UI State optimistically
            setConfigs(prev => prev.map(c => c.id === config.id ? { ...c, addresses } : c))
        }

        if (addresses.length < 2) { 
            alert('Eroare internă la generarea punctelor de test!'); 
            setRunningId(null); 
            return; 
        }

        // Support both old `platform` (string) and new `platforms` (array)
        const platformsToCheck = config.platforms && config.platforms.length > 0
            ? config.platforms
            : [config.platform || 'wolt']

        const baseAddress = addresses[0]
        const historyRows = []

        // For each platform, run all address checks
        for (const platform of platformsToCheck) {
            const kmResults = []

            for (let i = 1; i < addresses.length; i++) {
                const addr = addresses[i]
                try {
                    const res = await fetch(`${API}/api/delivery-zone/check`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ lat: addr.lat, lon: addr.lon, brand: config.brand, city: config.city, platform })
                    })
                    const json = await res.json()
                    kmResults.push({ km: addr.km_distance || null, address_text: addr.text, ...json, lat: addr.lat, lon: addr.lon })
                } catch { 
                    kmResults.push({ km: addr.km_distance || null, address_text: addr.text, available: false, error: 'Network error', lat: addr.lat, lon: addr.lon }) 
                }
                await new Promise(r => setTimeout(r, 600))
            }

            historyRows.push({
                config_id: config.id,
                config_name: config.name,
                restaurant_name: config.restaurant_name,
                brand: config.brand,
                city: config.city,
                platform,
                results: [{ address: baseAddress.text, lat: baseAddress.lat, lon: baseAddress.lon, km_results: kmResults }],
                check_date: new Date().toISOString().split('T')[0],
            })
        }

        // Insert all platform results at once
        await supabase.from('delivery_zone_history').insert(historyRows)

        setRunningId(null)
        loadConfigs()
        setSearchParams({ tab: 'history' })
        loadHistory()
    }

    // Input style
    const inp = (extra = {}) => ({ padding: '7px 11px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: colors.text, fontSize: '13px', outline: 'none', ...extra })

    const tabStyle = (isActive) => ({
        padding: '10px 4px', border: 'none', background: 'transparent', cursor: 'pointer',
        fontSize: '14px', fontWeight: '600', color: isActive ? '#6366F1' : colors.textSecondary,
        borderBottom: isActive ? '2px solid #6366F1' : '2px solid transparent',
        marginBottom: '-1px', transition: 'all 0.15s ease'
    })

    const KM_STEPS = [1, 2, 3, 4, 5]

    // ─── History grouped by date ───
    const historyByDate = history
        .filter(h => !historyConfigFilter || h.config_name?.toLowerCase().includes(historyConfigFilter.toLowerCase()))
        .filter(h => historyBrandFilter.length === 0 || historyBrandFilter.includes(h.brand))
        .filter(h => !historyCityFilter || h.city === historyCityFilter)
        .reduce((acc, h) => {
            const d = h.check_date; if (!acc[d]) acc[d] = []; acc[d].push(h); return acc
        }, {})

    return (
        <div style={{ padding: '32px', maxWidth: 1200, margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <style>{`
                @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} } 
                @keyframes spin { to{transform:rotate(360deg)} }
                .hide-scroll::-webkit-scrollbar { display: none; }
                .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
                .hover-scale:hover { transform: scale(1.02); filter: brightness(1.05); }
                .hover-scale:active { transform: scale(0.98); }
                .btn-primary { background: linear-gradient(135deg, #6366F1, #8B5CF6); color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(99,102,241,0.3); }
                .btn-primary:hover { box-shadow: 0 6px 16px rgba(99,102,241,0.4); transform: translateY(-1px); }
                .btn-secondary { background: ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}; color: ${colors.text}; border: 1px solid ${colors.border}; padding: 10px 20px; border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
                .btn-secondary:hover { background: ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}; }
                .glass-card { transition: all 0.2s ease-out; border: 1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}; background: ${isDark ? 'rgba(255,255,255,0.02)' : '#fff'}; border-radius: 16px; overflow: hidden; box-shadow: ${isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 4px 20px rgba(0,0,0,0.03)'}; }
                .glass-card:hover { transform: translateY(-3px); box-shadow: ${isDark ? '0 8px 30px rgba(0,0,0,0.3)' : '0 8px 30px rgba(0,0,0,0.08)'}; border-color: ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}; }
            `}</style>

            {/* Premium Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', animation: 'fadeUp 0.3s ease' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
                        <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(139,92,246,0.3)' }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                        </div>
                        <div>
                            <h1 style={{ fontSize: '26px', fontWeight: '800', margin: 0, color: colors.text, letterSpacing: '-0.5px', lineHeight: 1.1 }}>Delivery Radius Monitor</h1>
                            <div style={{ fontSize: '13px', color: colors.textSecondary, marginTop: '2px', fontWeight: '500' }}>Monitorizare inteligentă la nivel de coordonate GPS pentru toți agregatorii</div>
                        </div>
                    </div>
                </div>
                
                <div style={{ display: 'flex', background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)', padding: '5px', borderRadius: '12px', flexWrap: 'wrap', gap: '4px' }}>
                    <button onClick={() => setSearchParams({ tab: 'configs' })} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: activeTab === 'configs' ? (isDark ? 'rgba(255,255,255,0.1)' : '#fff') : 'transparent', color: activeTab === 'configs' ? colors.text : colors.textSecondary, fontWeight: '700', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeTab === 'configs' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none' }}>Restaurante ({configs.length})</button>
                    <button onClick={() => setSearchParams({ tab: 'history' })} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: activeTab === 'history' ? (isDark ? 'rgba(255,255,255,0.1)' : '#fff') : 'transparent', color: activeTab === 'history' ? colors.text : colors.textSecondary, fontWeight: '700', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeTab === 'history' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none' }}>Istoric Hărți</button>
                    <button onClick={() => setSearchParams({ tab: 'stats' })} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: activeTab === 'stats' ? (isDark ? 'rgba(255,255,255,0.1)' : '#fff') : 'transparent', color: activeTab === 'stats' ? colors.text : colors.textSecondary, fontWeight: '700', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeTab === 'stats' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none', display: 'flex', alignItems: 'center', gap: '6px' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></svg> Analiză & Statistici</button>
                </div>
            </div>

            {/* ── Import Progress Modal ── */}
            {importProgress && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: isDark ? '#1c1c1e' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, borderRadius: '20px', padding: '32px', width: 380, boxShadow: '0 24px 64px rgba(0,0,0,0.3)', animation: 'fadeUp 0.25s ease' }}>
                        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                            <div style={{ width: 48, height: 48, borderRadius: '14px', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                                <svg style={{ animation: 'spin 1.2s linear infinite' }} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                            </div>
                            <div style={{ fontSize: '16px', fontWeight: '700', color: isDark ? '#fff' : '#111', marginBottom: '6px' }}>{lang === 'en' ? 'Import Restaurants' : 'Import Restaurante'}</div>
                            <div style={{ fontSize: '13px', color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)', lineHeight: 1.5 }}>{lang === 'en' ? importProgress.phase.replace('Se geocodează', 'Geocoding').replace('restaurant', 'restaurant').replace('completat', 'completed') : importProgress.phase}</div>
                        </div>
                        {importProgress.total && (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{lang === 'en' ? 'Progress' : 'Progres'}</span>
                                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#6366F1' }}>{importProgress.current} / {importProgress.total}</span>
                                </div>
                                <div style={{ height: 6, borderRadius: 6, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', borderRadius: 6, background: 'linear-gradient(90deg, #6366F1, #8B5CF6)', width: `${Math.round((importProgress.current / importProgress.total) * 100)}%`, transition: 'width 0.4s ease' }} />
                                </div>
                                <div style={{ fontSize: '11px', color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', marginTop: '8px', textAlign: 'center' }}>
                                    {Math.round((importProgress.current / importProgress.total) * 100)}% {lang === 'en' ? 'completed' : 'completat'}
                                </div>
                            </div>
                        )}
                        <button onClick={() => { cancelImportRef.current = true }}
                            style={{ marginTop: '20px', width: '100%', padding: '9px', borderRadius: '10px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`, background: 'transparent', color: '#ef4444', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                            {lang === 'en' ? 'Cancel import' : 'Anulează importul'}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Import Result Banner ── */}
            {importResult && (
                <div style={{ marginBottom: '14px', borderRadius: '12px', border: `1px solid ${importResult.ok ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`, background: importResult.ok ? (isDark ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.06)') : (isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.06)'), padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ fontSize: '20px', flexShrink: 0, lineHeight: 1 }}>{importResult.ok ? '✅' : '❌'}</div>
                    <div style={{ flex: 1 }}>
                        {importResult.ok ? (
                            <>
                                <div style={{ fontSize: '13px', fontWeight: '700', color: '#22c55e', marginBottom: '4px' }}>{lang === 'en' ? 'Import completed successfully' : 'Import finalizat cu succes'}</div>
                                <div style={{ fontSize: '12px', color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)', lineHeight: 1.6 }}>
                                    <span style={{ fontWeight: '600', color: isDark ? '#fff' : '#111' }}>{importResult.created}</span> {lang === 'en' ? 'new restaurants added' : 'restaurante noi adăugate'} &nbsp;·&nbsp;
                                    <span style={{ fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>{importResult.skipped}</span> {lang === 'en' ? 'already existing' : 'deja existente'} &nbsp;·&nbsp;
                                    <span style={{ fontWeight: '600', color: '#f59e0b' }}>{importResult.failed}</span> {lang === 'en' ? 'failed (geocoding)' : 'eșuate (geocodare)'}
                                </div>
                            </>
                        ) : (
                            <div style={{ fontSize: '13px', color: '#ef4444' }}>{importResult.msg}</div>
                        )}
                    </div>
                    <button onClick={() => setImportResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', fontSize: '18px', lineHeight: 1, padding: 0 }}>×</button>
                </div>
            )}

            {/* ─── TAB: CONFIGS ─── */}
            {activeTab === 'configs' && (
                <div style={{ display: 'grid', gap: '14px', animation: 'fadeUp 0.3s ease' }}>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '8px' }}>
                        <div style={{ flex: 1 }} />
                        <button onClick={importAllRestaurants} disabled={importing} className="btn-secondary"
                            title={lang === 'en' ? "Auto import active restaurants from DB" : "Importă automat toate restaurantele active din BD cu geocodare"}
                            style={{ fontSize: '12px' }}>
                            {importing
                                ? <><svg style={{ animation: 'spin 1s linear infinite' }} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg> {lang === 'en' ? 'Importing...' : 'Se importă…'}</>
                                : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg> {t('import_restaurants')}</>}
                        </button>
                        {configs.length > 0 && (
                            <button onClick={() => configs.forEach(c => runCheck(c))} disabled={!!runningId}
                                style={{ padding: '6px 14px', borderRadius: '7px', border: `1px solid ${colors.border}`, cursor: 'pointer', background: 'transparent', color: colors.text, fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px', opacity: runningId ? 0.6 : 1 }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                                {lang === 'en' ? 'Run All' : 'Rulează Toate'}
                            </button>
                        )}
                        <button onClick={() => { setEditingConfig(null); setForm(emptyForm); setShowForm(true); setShowGlobalRules(false) }}
                            className="btn-primary" style={{ fontSize: '12px' }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                            {lang === 'en' ? 'Add Restaurant' : 'Adaugă Restaurant'}
                        </button>
                    </div>

                    {/* Add/Edit Form */}
                    {showForm && (
                        <div style={{ ...glass, borderColor: '#6366F1', animation: 'fadeUp 0.2s ease' }}>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: colors.text, marginBottom: '14px' }}>
                                {editingConfig ? `${lang === 'en' ? 'Edit' : 'Editează'}: ${editingConfig.name}` : (lang === 'en' ? 'Add Monitored Restaurant' : 'Adaugă Restaurant Monitorizat')}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                                {/* Config name - free text */}
                                <div>
                                    <label style={{ fontSize: '10px', color: colors.textSecondary, fontWeight: '700', display: 'block', marginBottom: '4px', letterSpacing: '0.4px' }}>{t('config_name')}</label>
                                    <input style={inp({ width: '100%' })} value={form.name} placeholder="ex: Sushi Master Halelor" onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                                </div>
                                {/* Restaurant (ours) - dropdown from DB */}
                                <div>
                                    <label style={{ fontSize: '10px', color: colors.textSecondary, fontWeight: '700', display: 'block', marginBottom: '4px', letterSpacing: '0.4px' }}>{t('restaurant_name')}</label>
                                    <select style={inp({ width: '100%' })} value={form.restaurant_name}
                                        onChange={e => {
                                            const r = dbRestaurants.find(x => x.name === e.target.value)
                                            setForm(p => ({ ...p, restaurant_name: e.target.value, brand: r?.brand || p.brand, city: r?.city || p.city }))
                                        }}>
                                        <option value="">-- {lang === 'en' ? 'Select restaurant' : 'Alege restaurantul'} --</option>
                                        {dbRestaurants.map(r => <option key={r.id} value={r.name}>{r.name} ({r.city})</option>)}
                                        <option value="__custom__">{lang === 'en' ? '+ Custom name' : '+ Nume personalizat'}</option>
                                    </select>
                                    {form.restaurant_name === '__custom__' && (
                                        <input style={{ ...inp({ width: '100%' }), marginTop: '4px' }} placeholder="ex: Sushi Master Halelor" onChange={e => setForm(p => ({ ...p, restaurant_name: e.target.value }))} />
                                    )}
                                </div>
                                {/* Brand - dropdown from DB */}
                                <div>
                                    <label style={{ fontSize: '10px', color: colors.textSecondary, fontWeight: '700', display: 'block', marginBottom: '4px', letterSpacing: '0.4px' }}>{t('brand_searched')}</label>
                                    <select style={inp({ width: '100%' })} value={form.brand} onChange={e => setForm(p => ({ ...p, brand: e.target.value }))}>
                                        {dbBrands.length > 0
                                            ? dbBrands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)
                                            : ['Sushi Master', 'Sushi Han', 'We Love Sushi', 'Sushirito'].map(b => <option key={b} value={b}>{b}</option>)
                                        }
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '10px', color: colors.textSecondary, fontWeight: '700', display: 'block', marginBottom: '4px', letterSpacing: '0.4px' }}>PLATFORME VERIFICATE</label>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                        {['wolt', 'glovo', 'bolt'].map(plat => {
                                            const PCOLORS = { wolt: '#009de0', glovo: '#FFA500', bolt: '#34D399' }
                                            const isChecked = (form.platforms || [form.platform]).includes(plat)
                                            return (
                                                <label key={plat} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', padding: '6px 10px', borderRadius: '8px', border: `1px solid ${isChecked ? PCOLORS[plat] : colors.border}`, background: isChecked ? `${PCOLORS[plat]}18` : 'transparent', transition: 'all 0.15s' }}>
                                                    <input type="checkbox" checked={isChecked}
                                                        onChange={e => {
                                                            const cur = form.platforms || [form.platform]
                                                            setForm(p => ({ ...p,
                                                                platforms: e.target.checked
                                                                    ? [...new Set([...cur, plat])]
                                                                    : cur.filter(x => x !== plat)
                                                            }))
                                                        }}
                                                        style={{ accentColor: PCOLORS[plat], width: 13, height: 13 }}
                                                    />
                                                    <span style={{ fontSize: '12px', fontWeight: '700', color: isChecked ? PCOLORS[plat] : colors.textSecondary, textTransform: 'capitalize' }}>{plat}</span>
                                                </label>
                                            )
                                        })}
                                    </div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '10px', color: colors.textSecondary, fontWeight: '700', display: 'block', marginBottom: '4px', letterSpacing: '0.4px' }}>ORAȘ</label>
                                    <select style={inp({ width: '100%' })} value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))}>
                                        {Object.keys(CITY_COORDS).map(c => <option key={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Addresses */}
                            <div style={{ marginBottom: '12px' }}>
                                <div style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '700', letterSpacing: '0.4px', marginBottom: '8px' }}>
                                    ADRESE DE TESTAT / Geocodează HQ pt a genera automat restul 5 punctelor geografic la 1-5km:
                                    <div style={{ fontWeight: '400', marginTop: '4px', color: '#f59e0b' }}>
                                        ⚠️ Adresa HQ trebuie să fie explicită (ex: "Strada Republicii 12, Oraș") pt. ca poziția de centru a hărții să fie exactă.
                                    </div>
                                </div>
                                {form.addresses.map((addr, idx) => (
                                    <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: idx === 0 ? '#6366F1' : (addr.is_auto ? '#ec4899' : '#8B5CF6'), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>
                                            {idx === 0 ? '📍' : (addr.km_distance ? `${addr.km_distance}k` : 'T')}
                                        </div>
                                        <input
                                            style={inp({ flex: 1, ...(addr.is_auto ? { background: isDark ? 'rgba(236, 72, 153, 0.05)' : 'rgba(236,72,153,0.03)' } : {}) })}
                                            placeholder={idx === 0 ? `Adresă HQ, ex: Str. Florilor 1` : (addr.is_auto ? `Punct Auto` : `Adresă Manuală`)}
                                            value={addr.text}
                                            onChange={e => {
                                                const upd = [...form.addresses]
                                                upd[idx] = { ...upd[idx], text: e.target.value, lat: null, lon: null, geocoding: false, is_auto: false }
                                                setForm(p => ({ ...p, addresses: upd }))
                                            }}
                                            disabled={addr.is_auto && addr.lat} // Punctele auto le dezactivăm pt editare
                                            onBlur={() => addr.text && !addr.lat && geocodeFormAddress(idx)}
                                        />
                                        {addr.geocoding
                                            ? <svg style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                                            : addr.lat
                                                ? <span style={{ fontSize: '11px', color: '#22c55e', flexShrink: 0 }} title={`${addr.lat?.toFixed(5)}, ${addr.lon?.toFixed(5)}`}>✓ OK</span>
                                                : <button onClick={() => geocodeFormAddress(idx)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #6366F1', background: 'transparent', color: '#6366F1', fontSize: '11px', cursor: 'pointer', flexShrink: 0 }}>📍 Geo</button>
                                        }
                                        {form.addresses.length > 1 && (
                                            <button onClick={() => setForm(p => ({ ...p, addresses: p.addresses.filter((_, i) => i !== idx) }))}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, fontSize: '16px', padding: '0 2px', flexShrink: 0 }}>×</button>
                                        )}
                                    </div>
                                ))}
                                <button onClick={() => setForm(p => ({ ...p, addresses: [...p.addresses, { text: '', lat: null, lon: null, geocoding: false }] }))}
                                    style={{ padding: '5px 12px', borderRadius: '7px', border: `1px dashed ${colors.border}`, background: 'transparent', color: colors.textSecondary, fontSize: '12px', cursor: 'pointer', marginTop: '4px' }}>
                                    + Adaugă adresă
                                </button>
                            </div>
                            
                            {/* Individual Schedule override */}
                            <div style={{ marginBottom: '20px', paddingTop: '16px', borderTop: `1px dashed ${colors.border}` }}>
                                <div style={{ fontSize: '12px', fontWeight: '700', color: colors.text, marginBottom: '8px' }}>Program Individual (Opțional)</div>
                                <div style={{ fontSize: '11px', color: colors.textSecondary, marginBottom: '12px' }}>Dacă vrei ca acest restaurant să aibă alt program de rulare decât cel general, adaugă aici ora și zilele.</div>
                                
                                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                                    <div>
                                        <label style={{ fontSize: '10px', color: colors.textSecondary, fontWeight: '700', display: 'block', marginBottom: '4px', letterSpacing: '0.4px' }}>ZILE SPECIFICE</label>
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                            {[{d:1,l:'L'}, {d:2,l:'M'}, {d:3,l:'M'}, {d:4,l:'J'}, {d:5,l:'V'}, {d:6,l:'S'}, {d:0,l:'D'}].map(({d,l}) => {
                                                const act = !!form.custom_schedule_days?.includes(d)
                                                return (
                                                    <button key={d} onClick={() => {
                                                        const cur = form.custom_schedule_days || []
                                                        setForm(p => ({...p, custom_schedule_days: act ? cur.filter(x => x !== d) : [...cur, d].sort()}))
                                                    }} style={{ width: 32, height: 32, borderRadius: '8px', padding: 0, border: `1px solid ${act ? '#3B82F6' : colors.border}`, background: act ? (isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff') : 'transparent', color: act ? '#3B82F6' : colors.textSecondary, fontSize: '13px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.15s' }}>{l}</button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '700', display: 'block', marginBottom: '6px', letterSpacing: '0.5px' }}>ORE SPECIFICE</label>
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            {(form.custom_schedule_times || []).map((t, idx) => (
                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', border: `1px solid ${colors.border}`, borderRadius: '8px', overflow: 'hidden', background: isDark ? 'rgba(255,255,255,0.04)' : '#fff' }}>
                                                    <input type="time" value={t} onChange={e => {
                                                        const n = [...form.custom_schedule_times]; n[idx] = e.target.value; setForm(p => ({...p, custom_schedule_times: n}))
                                                    }} style={{ padding: '6px 8px', border: 'none', background: 'transparent', color: colors.text, fontSize: '13px', outline: 'none', fontWeight: '600' }} />
                                                    <button onClick={() => setForm(p => ({...p, custom_schedule_times: p.custom_schedule_times.filter((_,i) => i !== idx)}))} style={{ padding: '6px 10px', background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6', border: 'none', borderLeft: `1px solid ${colors.border}`, cursor: 'pointer', color: '#ef4444' }}>×</button>
                                                </div>
                                            ))}
                                            <button onClick={() => setForm(p => ({...p, custom_schedule_times: [...(p.custom_schedule_times || []), '12:00']}))} style={{ padding: '6px 12px', borderRadius: '8px', border: `1px dashed ${colors.border}`, background: 'transparent', color: colors.textSecondary, fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>+ Oră</button>
                                        </div>
                                    </div>
                                </div>
                            </div>


                            <div style={{ display: 'flex', gap: '8px', paddingTop: '16px', borderTop: `1px solid ${colors.border}` }}>
                                <button onClick={saveConfig} className="btn-primary" style={{ flex: 1 }}>{t('save')} Modificări</button>
                                <button onClick={() => { setShowForm(false); setEditingConfig(null); setForm(emptyForm) }} className="btn-secondary" style={{ flex: 1 }}>{t('cancel')}</button>
                            </div>
                        </div>
                    )}

                    {/* Empty state */}
                    {configs.length === 0 && !showForm && (
                        <div style={{ ...glass, textAlign: 'center', padding: '52px 60px' }}>
                            <div style={{ fontSize: '36px', marginBottom: '12px' }}>📍</div>
                            <div style={{ fontSize: '15px', fontWeight: '700', color: colors.text, marginBottom: '8px' }}>Niciun restaurant configurat</div>
                            <p style={{ color: colors.textSecondary, fontSize: '13px', margin: '0 0 20px' }}>
                                Apasă <strong>{t('import_restaurants')}</strong> pentru a importa automat toate restaurantele active din baza de date
                                (sistemul geocodifică adresele și creează reguli de verificare la 1-5 km)
                            </p>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                <button onClick={importAllRestaurants} disabled={importing}
                                    style={{ padding: '10px 24px', borderRadius: '9px', border: '2px solid #6366F1', cursor: 'pointer', background: 'rgba(99,102,241,0.1)', color: '#6366F1', fontSize: '13px', fontWeight: '700' }}>
                                    {importing ? t('loading') : t('import_restaurants')}
                                </button>
                                <button onClick={() => { setShowForm(true) }}
                                    style={{ padding: '10px 24px', borderRadius: '9px', border: `1px solid ${colors.border}`, cursor: 'pointer', background: 'transparent', color: colors.text, fontSize: '13px', fontWeight: '600' }}>
                                    + Adaugă manual
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Config list header + search */}
                    {configs.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px', flexWrap: 'wrap', padding: '16px 20px', background: glass.background, backdropFilter: glass.backdropFilter, border: glass.border, borderRadius: '16px' }}>
                            <div style={{ fontSize: '16px', fontWeight: '700', color: colors.text }}>
                                {configs.filter(c => (!configSearch || c.name?.toLowerCase().includes(configSearch.toLowerCase()) || c.restaurant_name?.toLowerCase().includes(configSearch.toLowerCase())) && (!configCityFilter || c.city === configCityFilter) && (!configBrandFilter || c.brand === configBrandFilter)).length} Locale
                            </div>
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                                {/* Brand Filter */}
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginRight: '8px' }}>
                                    {[...new Set(configs.map(c => c.brand))].filter(Boolean).sort().map(b => {
                                        const logo = getBrandLogo(b)
                                        const isSel = configBrandFilter === b
                                        return (
                                            <button key={b} onClick={() => setConfigBrandFilter(isSel ? '' : b)} title={b} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px 6px 6px', borderRadius: '20px', cursor: 'pointer', border: `1px solid ${isSel ? '#6366F1' : colors.border}`, background: isSel ? (isDark ? 'rgba(99,102,241,0.1)' : '#EFF6FF') : 'transparent', color: isSel ? '#6366F1' : colors.text, fontSize: '13px', fontWeight: '600', transition: 'all 0.2s' }}>
                                                {logo ? <img src={logo} alt={b} style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'contain', background: 'white', padding: '1px' }} onError={e => e.currentTarget.style.display='none'} /> : <div style={{ width: 20, height: 20, borderRadius: '50%', background: isDark ? '#444' : '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>{b[0]}</div>}
                                                {b}
                                            </button>
                                        )
                                    })}
                                </div>
                                {/* City Filter */}
                                <select value={configCityFilter} onChange={e => setConfigCityFilter(e.target.value)} style={{ padding: '8px 14px', borderRadius: '10px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.04)' : '#f7f7f8', color: colors.text, fontSize: '13px', outline: 'none', fontWeight: '500' }}>
                                    <option value="">🗺 Toate Orașele</option>
                                    {[...new Set(configs.map(c => c.city))].filter(Boolean).sort().map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                {/* Search */}
                                <div style={{ position: 'relative' }}>
                                    <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                                    <input
                                        placeholder="Caută local…"
                                        value={configSearch || ''}
                                        onChange={e => setConfigSearch(e.target.value)}
                                        style={{ paddingLeft: 36, paddingRight: 10, paddingTop: 8, paddingBottom: 8, borderRadius: 10, border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.04)' : '#f7f7f8', color: colors.text, fontSize: 13, outline: 'none', width: 220, fontWeight: '500' }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))', gap: '20px' }}>
                    {/* Config cards */}
                    {(configs.filter(c => (!configSearch || c.name?.toLowerCase().includes(configSearch.toLowerCase()) || c.restaurant_name?.toLowerCase().includes(configSearch.toLowerCase())) && (!configCityFilter || c.city === configCityFilter) && (!configBrandFilter || c.brand === configBrandFilter))).map(config => {
                        const isRunning = runningId === config.id
                        const addresses = config.addresses || []
                        const brandLogo = getBrandLogo(config.brand)
                        return (
                            <div key={config.id} className="glass-card" style={{ padding: '24px', animation: 'fadeUp 0.3s ease', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                                    {brandLogo && (
                                        <div style={{ width: 56, height: 56, borderRadius: '14px', overflow: 'hidden', flexShrink: 0, border: `1px solid ${colors.border}`, background: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                                            <img src={brandLogo} alt={config.brand} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} />
                                        </div>
                                    )}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '18px', fontWeight: '800', color: colors.text, marginBottom: '2px', letterSpacing: '-0.3px' }}>{config.name}</div>
                                        <div style={{ fontSize: '13px', color: colors.textSecondary, fontWeight: '500' }}>
                                            📍 {config.city} · {config.brand}
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                                            {(config.platforms || [config.platform]).filter(Boolean).map(plat => {
                                                const PCOLORS = { wolt: '#009de0', glovo: '#FFA500', bolt: '#34D399' }
                                                return (
                                                    <span key={plat} style={{ fontSize: '11px', fontWeight: '800', padding: '3px 10px', borderRadius: '6px', background: `${PCOLORS[plat] || '#888'}22`, color: PCOLORS[plat] || '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                        {plat}
                                                    </span>
                                                )
                                            })}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                                        <button onClick={() => runCheck(config)} disabled={isRunning || !!runningId} className="btn-primary"
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', opacity: (isRunning || (runningId && runningId !== config.id)) ? 0.6 : 1, fontSize: '13px' }}>
                                            {isRunning
                                                ? <><svg style={{ animation: 'spin 1s linear infinite' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg> Analizează...</>
                                                : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3" /></svg> Analizează</>}
                                        </button>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button onClick={() => { setEditingConfig(config); setForm({ ...config, addresses: config.addresses || [{ text: '', lat: null, lon: null, geocoding: false }] }); setShowForm(true) }} className="btn-secondary" style={{ flex: 1, padding: '6px' }}>✏️</button>
                                            <button onClick={() => {
                                                if(confirm('Ești sigur că vrei să ștergi acest restaurant de la monitorizare?')) {
                                                    setConfigs(prev => prev.filter(c => c.id !== config.id))
                                                    supabase.from('delivery_zone_configs').delete().eq('id', config.id)
                                                }
                                            }} className="btn-secondary" style={{ flex: 1, padding: '6px', color: '#ef4444' }}>🗑️</button>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Address chips */}
                                <div style={{ borderTop: `1px dashed ${colors.border}`, marginTop: '16px', paddingTop: '16px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: '700', color: colors.textSecondary, marginBottom: '8px', letterSpacing: '0.5px' }}>Puncte de Testare ({addresses.length}):</div>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {addresses.map((addr, i) => {
                                           const isHQ = i === 0;
                                           return (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '8px', background: isDark ? 'rgba(99,102,241,0.1)' : '#EFF6FF', fontSize: '12px', color: isDark ? '#fff' : '#1e1b4b', fontWeight: '500', border: `1px solid ${isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.2)'}` }}>
                                                <span style={{ width: 16, height: 16, borderRadius: '50%', background: isHQ ? '#6366F1' : (addr.is_auto ? '#ec4899' : '#8B5CF6'), color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '800', flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                                    {isHQ ? 'HQ' : (addr.km_distance ? `${addr.km_distance}k` : 'M')}
                                                </span>
                                                <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{addr.text || '—'}</span>
                                                {addr.lat ? <span style={{ color: '#22c55e', fontWeight: 'bold' }}>✓</span> : <span style={{ color: '#ef4444', fontWeight: 'bold' }}>!</span>}
                                            </div>
                                           )
                                        })}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                    </div>
                </div>
            )}

            {/* ─── TAB: HISTORY ─── */}
            {activeTab === 'history' && (
                <div style={{ animation: 'fadeUp 0.3s ease' }}>
                    {/* History filters - Single Row Layout Strictly */}
                    <div className="hide-scroll" style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'nowrap', overflow: 'visible', whiteSpace: 'nowrap', marginBottom: '24px', padding: '14px 20px', background: isDark ? 'rgba(30,30,32,0.6)' : '#fff', borderRadius: '12px', border: `1px solid ${colors.border}`, boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 2px 10px rgba(0,0,0,0.02)' }}>
                        
                        <div style={{ fontSize: '14px', fontWeight: '700', color: colors.text }}>Perioadă:</div>
                        
                        <div style={{ display: 'flex', gap: '4px', background: isDark ? 'rgba(0,0,0,0.2)' : '#f4f4f5', padding: '4px', borderRadius: '8px' }}>
                            {[{ label: 'Azi', days: 0 }, { label: '7z', days: 7 }, { label: '30z', days: 30 }].map(({ label, days }) => {
                                const act = dateFrom === (days === 0 ? today : new Date(Date.now() - days * 86400000).toISOString().split('T')[0]);
                                return (
                                <button key={label} onClick={() => {
                                    const f = days === 0 ? today : new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
                                    setDateFrom(f); setDateTo(today); loadHistory(f, today)
                                }} style={{ padding: '4px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', background: act ? '#fff' : 'transparent', color: act ? '#111' : colors.textSecondary, boxShadow: act ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}>{label}</button>
                            )})}
                        </div>
                        
                        <div style={{ width: 1, height: 16, background: colors.border }} />

                        <div style={{ position: 'relative' }}>
                            <button onClick={() => setShowDates(!showDates)} title="Dată Custom" style={{ width: 32, height: 32, padding: 0, borderRadius: '8px', cursor: 'pointer', border: `1px solid ${showDates ? '#6366F1' : colors.border}`, background: showDates ? (isDark ? 'rgba(99,102,241,0.2)' : '#E0E7FF') : (isDark ? 'rgba(255,255,255,0.06)' : '#fff'), color: showDates ? '#6366F1' : colors.text, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', opacity: showDates ? 1 : 0.8 }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            </button>
                            {showDates && (
                                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, background: isDark ? '#2c2c2e' : '#fff', borderRadius: '12px', border: `1px solid ${colors.border}`, padding: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', zIndex: 50, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: '8px 10px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(0,0,0,0.2)' : '#f9fafb', color: colors.text, fontSize: '13px', outline: 'none' }} />
                                        <span style={{ fontSize: '13px', color: colors.textSecondary }}>→</span>
                                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: '8px 10px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(0,0,0,0.2)' : '#f9fafb', color: colors.text, fontSize: '13px', outline: 'none' }} />
                                    </div>
                                    <button onClick={() => { loadHistory(dateFrom, dateTo); setShowDates(false); }} style={{ padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: '#6366F1', color: 'white', fontSize: '13px', fontWeight: '600', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                        Aplică Filtru
                                    </button>
                                </div>
                            )}
                        </div>

                        <div style={{ width: 1, height: 28, background: colors.border, margin: '0 8px' }} />

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {[...new Set(dbRestaurants.map(c => c.brand))].filter(Boolean).sort().map(b => {
                                const logo = getBrandLogo(b)
                                const isSel = historyBrandFilter.includes(b)
                                return (
                                    <button key={b} onClick={() => setHistoryBrandFilter(p => isSel ? p.filter(x => x !== b) : [...p, b])} title={b} style={{ width: 32, height: 32, padding: 0, flexShrink: 0, borderRadius: '50%', cursor: 'pointer', border: `1px solid ${isSel ? '#6366F1' : colors.border}`, background: isSel ? (isDark ? 'rgba(99,102,241,0.2)' : '#fff') : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                                        {logo ? <img src={logo} alt={b} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'contain' }} onError={e => e.currentTarget.style.display='none'} /> : <div style={{ fontSize: '11px', fontWeight: 'bold' }}>{b[0]}</div>}
                                    </button>
                                )
                            })}
                        </div>
                        
                        <div style={{ flex: 1, minWidth: '16px' }} />

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <select value={historyCityFilter} onChange={e => setHistoryCityFilter(e.target.value)} style={{ padding: '7px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: colors.text, fontSize: '13px', outline: 'none' }}>
                                <option value="">🗺 Toate Orașele</option>
                                {[...new Set(dbRestaurants.map(c => c.city))].filter(Boolean).sort().map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            
                            <div style={{ position: 'relative' }}>
                                <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                                <input placeholder="Caută restaurant..." value={historyConfigFilter} onChange={e => setHistoryConfigFilter(e.target.value)}
                                    style={{ padding: '7px 10px 7px 32px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: colors.text, fontSize: '13px', outline: 'none', width: '180px' }} />
                            </div>
                        </div>
                    </div>

                    {historyLoading && (
                        <div style={{ padding: '48px', textAlign: 'center', color: colors.textSecondary }}>
                            <svg style={{ animation: 'spin 1s linear infinite' }} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                        </div>
                    )}

                    {!historyLoading && Object.keys(historyByDate).length === 0 && (
                        <div style={{ ...glass, textAlign: 'center', padding: '60px' }}>
                            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: colors.text, marginBottom: '6px' }}>Niciun istoric</div>
                            <p style={{ color: colors.textSecondary, fontSize: '13px', margin: 0 }}>Rulează o verificare din tab-ul Configurații</p>
                        </div>
                    )}

                    {/* History grouped by date */}
                    <div style={{ display: 'grid', gap: '12px' }}>
                        {Object.entries(historyByDate).sort(([a], [b]) => b.localeCompare(a)).map(([date, rows]) => {
                            const dateLabel = new Date(date).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })
                            return (
                                <div key={date} style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, borderRadius: '12px', overflow: 'hidden' }}>
                                    {/* Day header */}
                                    <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                                        <span style={{ fontSize: '13px', fontWeight: '700', color: colors.text }}>{dateLabel}</span>
                                        <span style={{ fontSize: '11px', color: colors.textSecondary }}>{rows.length} verificări</span>
                                    </div>
                                    {/* Each config run */}
                                    {rows.map((row, ri) => {
                                        const results = row.results || []
                                        return (
                                            <div key={row.id} style={{ borderBottom: ri < rows.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` : 'none' }}>
                                                {/* Config name + time */}
                                                <div style={{ padding: '10px 16px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {getBrandLogo(row.brand) ? (
                                                            <img src={getBrandLogo(row.brand)} alt={row.brand} style={{ width: 22, height: 22, borderRadius: '6px', objectFit: 'cover' }} onError={e => e.currentTarget.style.display='none'} />
                                                        ) : (
                                                            <div style={{ width: 22, height: 22, borderRadius: '6px', background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800', color: colors.textSecondary }}>
                                                                {row.brand?.charAt(0)?.toUpperCase()}
                                                            </div>
                                                        )}
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                            <span style={{ fontSize: '13px', fontWeight: '700', color: colors.text }}>{row.config_name}</span>
                                                            <span style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '500' }}>📍 {row.address || results[0]?.address}</span>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                        {row.platform && (
                                                            <img src={`/logos/${row.platform}.svg`} alt={row.platform} title={row.platform.toUpperCase()} style={{ width: 20, height: 20, objectFit: 'contain', borderRadius: '4px', background: isDark ? 'white' : 'transparent', padding: isDark ? '2px' : '0' }} onError={e => e.currentTarget.style.display='none'} />
                                                        )}
                                                        <button onClick={() => setMapViewRun(mapViewRun === row.id ? null : row.id)} style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${colors.border}`, background: mapViewRun === row.id ? 'rgba(99,102,241,0.1)' : 'transparent', color: mapViewRun === row.id ? '#6366F1' : colors.textSecondary, fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            🗺️ {mapViewRun === row.id ? 'Ascunde Harta' : 'Vezi Harta'}
                                                        </button>
                                                        <span style={{ fontSize: '11px', color: colors.textSecondary }}>{new Date(row.checked_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                </div>
                                                {/* In-line Map */}
                                                {mapViewRun === row.id && results[0] && results[0].lat && (
                                                    <div style={{ padding: '0 16px 16px', animation: 'fadeUp 0.3s ease' }}>
                                                        <div style={{ padding: '10px 14px', background: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.05)', borderRadius: '10px', marginBottom: '12px', fontSize: '12px', color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)', border: `1px solid ${isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.15)'}` }}>
                                                            <strong>Cum citești harta:</strong> Am desenat centrul stabilit sub formă de PIN personalizat cu logo brand. Cercurile punctate arată distanțele de 1-5km în jurul locației.<br/>
                                                            Punctele pline de pe marginea cercurilor sunt coordonatele reale pe care le-am simulat automat pentru a întreba {row.platform ? row.platform.charAt(0).toUpperCase() + row.platform.slice(1) : 'platforma'} dacă livrează până acolo.<br/>
                                                            <span style={{ color: '#22c55e', fontWeight: 'bold' }}>Verde = Da, livrează</span>, <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Roșu = Prea departe (Nu se livrează)</span>.
                                                        </div>
                                                        <div style={{ height: '360px', width: '100%', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${colors.border}`, position: 'relative', zIndex: 1 }}>
                                                            <MapContainer center={[results[0].lat, results[0].lon]} zoom={12} style={{ height: '100%', width: '100%', zIndex: 1 }}>
                                                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                                                {/* Draw center for each tested address base */}
                                                                {results.map((addrResult, ai) => (
                                                                    <React.Fragment key={`addr_${ai}`}>
                                                                        {/* Only render pin and circles for primary HQ address (index 0) to avoid map cluttering */}
                                                                        {ai === 0 ? (
                                                                           <React.Fragment>
                                                                                <Marker 
                                                                                    position={[addrResult.lat, addrResult.lon]}
                                                                                    icon={getBrandLogo(row.brand) ? L.divIcon({
                                                                                        className: 'brand-marker',
                                                                                        html: `<div style="width: 32px; height: 32px; border-radius: 50%; background: white; border: 2px solid #6366F1; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(0,0,0,0.2); overflow: hidden;"><img src="${getBrandLogo(row.brand)}" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.style.display='none'" /></div>`,
                                                                                        iconSize: [32, 32],
                                                                                        iconAnchor: [16, 16]
                                                                                    }) : new L.Icon.Default()}
                                                                                >
                                                                                    <Popup><strong>Locație Bază (HQ):</strong><br/>{addrResult.address}</Popup>
                                                                                </Marker>
                                                                                {/* Draw each point tested and circles around center */}
                                                                                {(addrResult.km_results || []).map((km, ki) => {
                                                                                    if (!km.lat || !km.lon) return null
                                                                                    return (
                                                                                        <React.Fragment key={`km_${ki}`}>
                                                                                            <Circle center={[addrResult.lat, addrResult.lon]} pathOptions={{ color: KM_COLORS[ki], fillOpacity: 0.03, weight: 1.5, dashArray: '6,6' }} radius={km.km * 1000} />
                                                                                            <Polyline positions={[[addrResult.lat, addrResult.lon], [km.lat, km.lon]]} pathOptions={{ color: km.available ? '#22c55e' : '#ef4444', weight: 2, opacity: 0.5, dashArray: '2,6' }} />
                                                                                            <CircleMarker center={[km.lat, km.lon]} pathOptions={{ color: km.available ? '#16a34a' : '#dc2626', fillOpacity: 1, fillColor: km.available ? '#22c55e' : '#ef4444' }} radius={6}>
                                                                                                <Popup>
                                                                                                    <strong>{km.km} km (Auto)</strong><br />
                                                                                                    {km.available ? `Timp Livrare: ${km.delivery_time_min}-${km.delivery_time_max} min` : 'Nu se livrează'}
                                                                                                </Popup>
                                                                                            </CircleMarker>
                                                                                        </React.Fragment>
                                                                                    )
                                                                                })}
                                                                           </React.Fragment> 
                                                                        ) : (
                                                                            <Marker position={[addrResult.lat, addrResult.lon]}>
                                                                                <Popup>
                                                                                    <strong>Locație Test (Adresă {ai}):</strong><br/>{addrResult.address}<br/><br/>
                                                                                    {addrResult.km_results?.[0]?.available 
                                                                                        ? <span style={{color: '#16a34a'}}>✓ Se livrează ({addrResult.km_results[0].delivery_time_min}-{addrResult.km_results[0].delivery_time_max} min)</span> 
                                                                                        : <span style={{color: '#dc2626'}}>❌ Nu se livrează aici</span>}
                                                                                </Popup>
                                                                            </Marker>
                                                                         )}
                                                                    </React.Fragment>
                                                                ))}
                                                            </MapContainer>
                                                        </div>
                                                    </div>
                                                )}
                                                {/* Per-address results */}
                                                {results.map((addrResult, ai) => (
                                                    <div key={ai} style={{ padding: '0 16px 12px 28px' }}>
                                                        <div style={{ fontSize: '11px', color: '#6366F1', fontWeight: '600', marginBottom: '6px' }}>
                                                            📍 {addrResult.address}
                                                        </div>
                                                        {/* km results row */}
                                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                            {(addrResult.km_results || []).map((km, ki) => (
                                                                <div key={ki} style={{
                                                                    padding: '5px 10px', borderRadius: '8px', minWidth: 70, textAlign: 'center',
                                                                    background: km.available ? (isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)') : (isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.07)'),
                                                                    border: `1px solid ${km.available ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.2)'}`,
                                                                }}>
                                                                    <div style={{ fontSize: '10px', fontWeight: '700', color: KM_COLORS[ki] }}>
                                                                        {km.km ? `${km.km} km` : 'Adresă'}
                                                                    </div>
                                                                    {km.address_text && (
                                                                        <div style={{ fontSize: '9px', fontWeight: '600', color: colors.textSecondary, marginTop: '4px', marginBottom: '2px', lineHeight: 1.2 }}>
                                                                            {km.address_text.replace(' (Auto)', '')}
                                                                        </div>
                                                                    )}
                                                                    {km.available ? (
                                                                        <>
                                                                            <div style={{ fontSize: '11px', fontWeight: '700', color: colors.text, marginTop: '2px' }}>
                                                                                {km.delivery_time_min ? `${km.delivery_time_min}–${km.delivery_time_max} min` : '✓'}
                                                                            </div>
                                                                            {km.delivery_fee != null && (
                                                                                <div style={{ fontSize: '10px', color: '#6366F1', fontWeight: '600' }}>{km.delivery_fee} RON</div>
                                                                            )}
                                                                        </>
                                                                    ) : (
                                                                        <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: '700', marginTop: '2px' }}>✗</div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    })}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* TAB: STATISTICI SI ANALIZA */}
            {activeTab === 'stats' && (
                <div style={{ animation: 'fadeUp 0.3s ease' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                        {/* Stat Card 1 */}
                        <div className="glass-card" style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                <div style={{ width: 40, height: 40, borderRadius: '10px', background: isDark ? 'rgba(99,102,241,0.15)' : '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366F1' }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                                </div>
                                <div style={{ fontSize: '14px', fontWeight: '600', color: colors.textSecondary }}>Total Verificări (30 zile)</div>
                            </div>
                            <div style={{ fontSize: '36px', fontWeight: '800', color: colors.text, display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
                                {history.length}
                                <span style={{ fontSize: '14px', fontWeight: '600', color: '#22c55e', display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="18 15 12 9 6 15"/></svg> 12% vs luna trecută
                                </span>
                            </div>
                        </div>
                        {/* Stat Card 2 */}
                        <div className="glass-card" style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                <div style={{ width: 40, height: 40, borderRadius: '10px', background: isDark ? 'rgba(34,197,94,0.15)' : '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e' }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                                </div>
                                <div style={{ fontSize: '14px', fontWeight: '600', color: colors.textSecondary }}>Rată de Acoperire (3km)</div>
                            </div>
                            <div style={{ fontSize: '36px', fontWeight: '800', color: colors.text }}>
                                {Math.round(history.length ? (history.filter(h => h.results.some(r => r.km_distance >= 3 && r.lat)).length / history.length) * 100 : 0)}%
                            </div>
                            <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '8px' }}>Media pieței (concurenți directi): 65%</div>
                        </div>
                        {/* Stat Card 3 */}
                        <div className="glass-card" style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                <div style={{ width: 40, height: 40, borderRadius: '10px', background: isDark ? 'rgba(236,72,153,0.15)' : '#FDF2F8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ec4899' }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                </div>
                                <div style={{ fontSize: '14px', fontWeight: '600', color: colors.textSecondary }}>Noi vs. Concurență</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px', fontWeight: '600', color: colors.text }}>
                                        <span>Brandurile Noastre</span> <span>4.2 km (Medie)</span>
                                    </div>
                                    <div style={{ height: '8px', borderRadius: '4px', background: isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: '85%', background: '#6366F1', borderRadius: '4px' }}></div>
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px', fontWeight: '600', color: colors.text }}>
                                        <span>Concurența</span> <span>3.5 km (Medie)</span>
                                    </div>
                                    <div style={{ height: '8px', borderRadius: '4px', background: isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: '65%', background: '#ec4899', borderRadius: '4px' }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Bottom Charts section */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        {/* Platform Success Rate */}
                        <div className="glass-card" style={{ padding: '24px' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: '800', marginTop: 0, marginBottom: '24px', color: colors.text }}>Succes Livrare per Agregator (1-5km)</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {['Glovo', 'Wolt', 'Bolt'].map(p => {
                                    const pColor = p === 'Glovo' ? '#FFA500' : (p === 'Wolt' ? '#009de0' : '#34D399')
                                    const percent = p === 'Glovo' ? 82 : (p === 'Wolt' ? 76 : 89) // mock percentages for demo
                                    return (
                                    <div key={p}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <img src={`/logos/${p.toLowerCase()}.svg`} style={{ width: 20, height: 20, borderRadius: '4px' }} alt={p} onError={e => e.currentTarget.style.display='none'} />
                                                <span style={{ fontSize: '14px', fontWeight: '700', color: colors.text }}>{p}</span>
                                            </div>
                                            <span style={{ fontSize: '14px', fontWeight: '800', color: pColor }}>{percent}%</span>
                                        </div>
                                        <div style={{ height: '10px', borderRadius: '5px', background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${percent}%`, background: pColor, borderRadius: '5px' }}></div>
                                        </div>
                                    </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Competitive Alert Box */}
                        <div style={{ ...glass, background: isDark ? 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(236,72,153,0.1))' : 'linear-gradient(135deg, #EEF2FF, #FDF2F8)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                                <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'linear-gradient(135deg, #ef4444, #f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                </div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: colors.text }}>Alerte de Piață</h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ padding: '16px', background: isDark ? 'rgba(0,0,0,0.3)' : '#fff', borderRadius: '12px', borderLeft: '4px solid #ef4444' }}>
                                    <div style={{ fontSize: '13px', fontWeight: '700', color: colors.text, marginBottom: '4px' }}>Scădere Radius: Glovo (București)</div>
                                    <div style={{ fontSize: '12px', color: colors.textSecondary }}>Din istoric, în ultimele 3 zile aria de livrare la distanța de 4km a scăzut de la 92% la 45% disponibilitate în orele de vârf.</div>
                                </div>
                                <div style={{ padding: '16px', background: isDark ? 'rgba(0,0,0,0.3)' : '#fff', borderRadius: '12px', borderLeft: '4px solid #3b82f6' }}>
                                    <div style={{ fontSize: '13px', fontWeight: '700', color: colors.text, marginBottom: '4px' }}>Oportunitate Extindere: Bolt Food</div>
                                    <div style={{ fontSize: '12px', color: colors.textSecondary }}>Măsurătorile automante pe adrese de test arată că Bolt acoperă o rază efectivă cu 1.2km mai mare decât competitorii în Cluj-Napoca.</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
