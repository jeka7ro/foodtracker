import { useState, useEffect } from 'react'
import { useTheme } from '../lib/ThemeContext'
import { supabase } from '../lib/supabaseClient'
import toast, { Toaster } from 'react-hot-toast'

export default function Discovery() {
    const { colors } = useTheme()
    const [isScanning, setIsScanning] = useState(false)
    const [results, setResults] = useState([])
    const [progress, setProgress] = useState('')
    const [savedUrls, setSavedUrls] = useState({}) // track saved URLs { url: restaurantId }
    const [existingRestaurants, setExistingRestaurants] = useState([])
    const [selectedResults, setSelectedResults] = useState(new Set())
    const [savingAll, setSavingAll] = useState(false)

    // Fetch existing restaurants to check for duplicates
    useEffect(() => {
        fetchExistingRestaurants()
    }, [])

    async function fetchExistingRestaurants() {
        try {
            const { data, error } = await supabase
                .from('restaurants')
                .select('*')
            if (error) throw error
            setExistingRestaurants(data || [])
        } catch (error) {
            console.error('Error fetching restaurants:', error)
        }
    }

    // Check if a URL already exists in restaurants
    function isUrlAlreadySaved(url) {
        return existingRestaurants.some(r =>
            r.glovo_url === url || r.wolt_url === url || r.bolt_url === url
        )
    }

    // Find existing restaurant that matches name + city
    function findExistingRestaurant(name, city) {
        return existingRestaurants.find(r =>
            r.name?.toLowerCase() === name?.toLowerCase() &&
            r.city?.toLowerCase() === city?.toLowerCase()
        )
    }

    const startDiscovery = async () => {
        setIsScanning(true)
        setResults([])
        setSelectedResults(new Set())
        setProgress('Starting URL discovery...')

        try {
            const response = await fetch('http://localhost:3001/api/discover-urls', {
                method: 'POST'
            })

            if (!response.ok) {
                throw new Error('Discovery failed')
            }

            const data = await response.json()
            setResults(data.results || [])
            setProgress(`✅ Discovery complete! Found ${data.results?.length || 0} URLs`)

            // Refresh existing restaurants to check for duplicates
            await fetchExistingRestaurants()
        } catch (error) {
            console.error('Error during discovery:', error)
            setProgress('❌ Error during discovery: ' + error.message)
        } finally {
            setIsScanning(false)
        }
    }

    // Save a single discovered URL as a new restaurant or update existing one
    async function saveAsRestaurant(record) {
        try {
            const platformUrlField = `${record.platform}_url`
            const existing = findExistingRestaurant(record.name, record.city)

            if (existing) {
                // Update existing restaurant with the new platform URL
                const { error } = await supabase
                    .from('restaurants')
                    .update({ [platformUrlField]: record.url })
                    .eq('id', existing.id)

                if (error) throw error

                toast.success(`Updated ${existing.name} with ${record.platform} URL`, {
                    duration: 3000,
                    position: 'top-right'
                })
            } else {
                // Create new restaurant
                const newRestaurant = {
                    name: record.name,
                    city: record.city,
                    is_active: true,
                    [platformUrlField]: record.url,
                    working_hours: {
                        monday: { open: '10:00', close: '23:00' },
                        tuesday: { open: '10:00', close: '23:00' },
                        wednesday: { open: '10:00', close: '23:00' },
                        thursday: { open: '10:00', close: '23:00' },
                        friday: { open: '10:00', close: '23:00' },
                        saturday: { open: '10:00', close: '23:00' },
                        sunday: { open: '10:00', close: '23:00' }
                    }
                }

                const { error } = await supabase
                    .from('restaurants')
                    .insert([newRestaurant])

                if (error) throw error

                toast.success(`Saved "${record.name}" as new restaurant!`, {
                    duration: 3000,
                    position: 'top-right'
                })
            }

            // Mark as saved
            setSavedUrls(prev => ({ ...prev, [record.url]: true }))

            // Refresh existing restaurants
            await fetchExistingRestaurants()

        } catch (error) {
            console.error('Error saving restaurant:', error)
            toast.error('Error: ' + error.message, { duration: 4000, position: 'top-right' })
        }
    }

    // Save all selected results
    async function saveAllSelected() {
        if (selectedResults.size === 0) {
            toast.error('Select at least one URL to save', { duration: 3000, position: 'top-right' })
            return
        }

        setSavingAll(true)
        let saved = 0
        let errors = 0

        for (const result of results) {
            if (selectedResults.has(result.url) && !isUrlAlreadySaved(result.url) && !savedUrls[result.url]) {
                try {
                    await saveAsRestaurant(result)
                    saved++
                } catch {
                    errors++
                }
            }
        }

        setSavingAll(false)
        setSelectedResults(new Set())

        if (saved > 0) {
            toast.success(`Saved ${saved} restaurant(s)!`, { duration: 3000, position: 'top-right' })
        }
        if (errors > 0) {
            toast.error(`${errors} failed to save`, { duration: 3000, position: 'top-right' })
        }
    }

    // Toggle selection
    function toggleSelect(url) {
        setSelectedResults(prev => {
            const next = new Set(prev)
            if (next.has(url)) {
                next.delete(url)
            } else {
                next.add(url)
            }
            return next
        })
    }

    // Select all unsaved
    function selectAllUnsaved() {
        const unsaved = results.filter(r => !isUrlAlreadySaved(r.url) && !savedUrls[r.url])
        setSelectedResults(new Set(unsaved.map(r => r.url)))
    }

    const groupedResults = results.reduce((acc, record) => {
        const key = record.platform
        if (!acc[key]) acc[key] = []
        acc[key].push(record)
        return acc
    }, {})

    const unsavedCount = results.filter(r => !isUrlAlreadySaved(r.url) && !savedUrls[r.url]).length

    return (
        <div style={{ padding: '24px 32px', }}>
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, color: colors.text, letterSpacing: '-0.5px' }}>
                    URL Discovery
                </h1>
                <p style={{ fontSize: '13px', color: colors.textSecondary, marginTop: '4px' }}>
                    Automatically find restaurant URLs across all platforms and save them
                </p>
            </div>

            {/* Control Panel */}
            <div style={{
                background: colors.card,
                backdropFilter: 'blur(20px)',
                border: `0.5px solid ${colors.border}`,
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '24px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <button
                        onClick={startDiscovery}
                        disabled={isScanning}
                        style={{
                            padding: '12px 24px',
                            background: isScanning ? colors.textSecondary : colors.blue,
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: isScanning ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                            opacity: isScanning ? 0.6 : 1
                        }}
                    >
                        {isScanning ? 'Scanning...' : 'Start Discovery'}
                    </button>

                    {results.length > 0 && unsavedCount > 0 && (
                        <>
                            <button
                                onClick={selectAllUnsaved}
                                style={{
                                    padding: '10px 20px',
                                    background: colors.bg,
                                    color: colors.text,
                                    border: `0.5px solid ${colors.border}`,
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    cursor: 'pointer'
                                }}
                            >
                                Select All New ({unsavedCount})
                            </button>

                            <button
                                onClick={saveAllSelected}
                                disabled={selectedResults.size === 0 || savingAll}
                                style={{
                                    padding: '10px 20px',
                                    background: selectedResults.size > 0 ? colors.green : colors.textSecondary,
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: selectedResults.size > 0 ? 'pointer' : 'not-allowed',
                                    opacity: selectedResults.size > 0 ? 1 : 0.5
                                }}
                            >
                                {savingAll ? '💾 Saving...' : `💾 Save Selected (${selectedResults.size})`}
                            </button>
                        </>
                    )}

                    {progress && (
                        <div style={{ fontSize: '13px', color: colors.textSecondary }}>
                            {progress}
                        </div>
                    )}
                </div>

                <div style={{ fontSize: '12px', color: colors.textSecondary, lineHeight: '1.6' }}>
                    <strong>What this does:</strong>
                    <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                        <li>Searches for "Sushi Master" on Glovo, Wolt, and Bolt</li>
                        <li>Scans multiple cities: București, Cluj-Napoca, Timișoara, Iași, Brașov, etc.</li>
                        <li>Extracts restaurant URLs automatically</li>
                        <li><strong>Save individual</strong> URLs or <strong>bulk save</strong> as restaurants</li>
                    </ul>
                </div>
            </div>

            {/* Results */}
            {results.length > 0 && (
                <div style={{ display: 'grid', gap: '16px' }}>
                    {Object.entries(groupedResults).map(([platform, records]) => (
                        <div key={platform} style={{
                            background: colors.card,
                            backdropFilter: 'blur(20px)',
                            border: `0.5px solid ${colors.border}`,
                            borderRadius: '12px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                padding: '16px 20px',
                                background: `${colors.bg}80`,
                                borderBottom: `0.5px solid ${colors.border}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <h3 style={{
                                    fontSize: '16px',
                                    fontWeight: '600',
                                    margin: 0,
                                    color: colors.text,
                                    textTransform: 'capitalize'
                                }}>
                                    {platform === 'glovo' && 'Glovo'}
                                    {platform === 'wolt' && 'Wolt'}
                                    {platform === 'bolt' && 'Bolt'}
                                    {' '}{platform} ({records.length} URLs)
                                </h3>
                                <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                                    {records.filter(r => isUrlAlreadySaved(r.url) || savedUrls[r.url]).length} saved
                                </span>
                            </div>

                            <div style={{ padding: '12px' }}>
                                {records.map((record, idx) => {
                                    const alreadySaved = isUrlAlreadySaved(record.url) || savedUrls[record.url]
                                    const isSelected = selectedResults.has(record.url)
                                    const existingMatch = findExistingRestaurant(record.name, record.city)

                                    return (
                                        <div key={idx} style={{
                                            padding: '14px 16px',
                                            marginBottom: '8px',
                                            background: alreadySaved
                                                ? `${colors.green}10`
                                                : isSelected
                                                    ? `${colors.blue}15`
                                                    : `${colors.bg}40`,
                                            borderRadius: '8px',
                                            border: `0.5px solid ${alreadySaved ? colors.green : isSelected ? colors.blue : colors.border}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            transition: 'all 0.2s'
                                        }}>
                                            {/* Checkbox for unsaved */}
                                            {!alreadySaved && (
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelect(record.url)}
                                                    style={{
                                                        width: '18px',
                                                        height: '18px',
                                                        cursor: 'pointer',
                                                        accentColor: colors.blue,
                                                        flexShrink: 0
                                                    }}
                                                />
                                            )}

                                            {/* Saved badge */}
                                            {alreadySaved && (
                                                <div style={{
                                                    width: '18px',
                                                    height: '18px',
                                                    borderRadius: '50%',
                                                    background: colors.green,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '11px',
                                                    color: 'white',
                                                    flexShrink: 0
                                                }}>
                                                    ✓
                                                </div>
                                            )}

                                            {/* Info */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{
                                                    fontSize: '14px',
                                                    fontWeight: '600',
                                                    color: colors.text,
                                                    marginBottom: '3px'
                                                }}>
                                                    {record.name}
                                                    {existingMatch && !alreadySaved && (
                                                        <span style={{
                                                            fontSize: '10px',
                                                            color: colors.orange,
                                                            marginLeft: '8px',
                                                            fontWeight: '500'
                                                        }}>
                                                            (will update existing)
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>
                                                    📍 {record.city}
                                                </div>
                                                <a
                                                    href={record.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{
                                                        fontSize: '11px',
                                                        color: colors.blue,
                                                        textDecoration: 'none',
                                                        wordBreak: 'break-all',
                                                        fontFamily: 'monospace'
                                                    }}
                                                >
                                                    {record.url}
                                                </a>
                                            </div>

                                            {/* Actions */}
                                            {alreadySaved ? (
                                                <span style={{
                                                    fontSize: '11px',
                                                    color: colors.green,
                                                    fontWeight: '600',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    ✅ Saved
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => saveAsRestaurant(record)}
                                                    style={{
                                                        padding: '8px 16px',
                                                        background: colors.green,
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        cursor: 'pointer',
                                                        whiteSpace: 'nowrap',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseOver={e => e.currentTarget.style.opacity = '0.85'}
                                                    onMouseOut={e => e.currentTarget.style.opacity = '1'}
                                                >
                                                    💾 Save
                                                </button>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty State */}
            {!isScanning && results.length === 0 && (
                <div style={{
                    background: colors.card,
                    backdropFilter: 'blur(20px)',
                    border: `0.5px solid ${colors.border}`,
                    borderRadius: '12px',
                    padding: '60px 40px',
                    textAlign: 'center'
                }}>
                    <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg></div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: colors.text, marginBottom: '8px' }}>
                        Ready to discover restaurant URLs
                    </div>
                    <div style={{ fontSize: '13px', color: colors.textSecondary }}>
                        Click "Start Discovery" to begin scanning all platforms
                    </div>
                </div>
            )}

            <Toaster />
        </div>
    )
}
