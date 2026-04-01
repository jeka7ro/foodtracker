import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useTheme } from '../lib/ThemeContext'
import toast, { Toaster } from 'react-hot-toast'
import { TableSkeleton } from '../components/LoadingSkeleton'
import { ConfirmDialog } from '../components/ConfirmDialog'

export default function Restaurants() {
    const { colors } = useTheme()
    const [restaurants, setRestaurants] = useState([])
    const [brands, setBrands] = useState([])
    const [selectedBrand, setSelectedBrand] = useState('all')
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingRestaurant, setEditingRestaurant] = useState(null)
    const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, restaurant: null })
    const [searchQuery, setSearchQuery] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [sortBy, setSortBy] = useState('name')
    const [sortDir, setSortDir] = useState('asc')
    const [lastUpdated, setLastUpdated] = useState(null)
    const ITEMS_PER_PAGE = 20
    const [formData, setFormData] = useState({
        name: '',
        city: '',
        address: '',
        glovo_url: '',
        wolt_url: '',
        bolt_url: '',
        telegram_group_id: '',
        is_active: true,
        is_competitor: false,
        working_hours: {
            monday: { open: '10:00', close: '23:00' },
            tuesday: { open: '10:00', close: '23:00' },
            wednesday: { open: '10:00', close: '23:00' },
            thursday: { open: '10:00', close: '23:00' },
            friday: { open: '10:00', close: '23:00' },
            saturday: { open: '10:00', close: '23:00' },
            sunday: { open: '10:00', close: '23:00' }
        }
    })

    useEffect(() => {
        fetchRestaurants()
        fetchBrands()
    }, [])

    async function fetchBrands() {
        try {
            const { data } = await supabase.from('brands').select('id, name').order('name')
            setBrands(data || [])
        } catch (err) {
            console.error('Error fetching brands:', err)
        }
    }

    async function fetchRestaurants() {
        try {
            const { data, error } = await supabase
                .from('restaurants')
                .select('*, brands(id, name, logo_url)')
                .order('city', { ascending: true })
                .order('name', { ascending: true })

            if (error) throw error
            setRestaurants(data || [])
            setLastUpdated(new Date())
        } catch (error) {
            console.error('Error fetching restaurants:', error)
        } finally {
            setLoading(false)
        }
    }

    async function handleSubmit(e) {
        e.preventDefault()

        try {
            if (editingRestaurant) {
                const { error } = await supabase
                    .from('restaurants')
                    .update(formData)
                    .eq('id', editingRestaurant.id)
                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('restaurants')
                    .insert([formData])
                if (error) throw error
            }

            setShowModal(false)
            setEditingRestaurant(null)
            resetForm()
            fetchRestaurants()

            toast.success(
                editingRestaurant ? 'Restaurant updated successfully!' : 'Restaurant added successfully!',
                { duration: 3000, position: 'top-right' }
            )
        } catch (error) {
            console.error('Error saving restaurant:', error)
            toast.error('Error: ' + error.message, { duration: 4000, position: 'top-right' })
        }
    }

    async function handleDelete(restaurant) {
        setDeleteConfirm({ isOpen: true, restaurant })
    }

    async function confirmDelete() {
        try {
            const { error } = await supabase
                .from('restaurants')
                .delete()
                .eq('id', deleteConfirm.restaurant.id)
            if (error) throw error

            fetchRestaurants()
            toast.success('Restaurant deleted successfully!', { duration: 3000, position: 'top-right' })
        } catch (error) {
            console.error('Error deleting restaurant:', error)
            toast.error('Error: ' + error.message, { duration: 4000, position: 'top-right' })
        } finally {
            setDeleteConfirm({ isOpen: false, restaurant: null })
        }
    }

    function openAddModal() {
        resetForm()
        setEditingRestaurant(null)
        setShowModal(true)
    }

    function openEditModal(restaurant) {
        setFormData({
            name: restaurant.name,
            city: restaurant.city,
            address: restaurant.address || '',
            glovo_url: restaurant.glovo_url || '',
            wolt_url: restaurant.wolt_url || '',
            bolt_url: restaurant.bolt_url || '',
            telegram_group_id: restaurant.telegram_group_id || '',
            is_active: restaurant.is_active,
            is_competitor: restaurant.is_competitor || false,
            working_hours: restaurant.working_hours || formData.working_hours
        })
        setEditingRestaurant(restaurant)
        setShowModal(true)
    }

    function resetForm() {
        setFormData({
            name: '',
            city: '',
            address: '',
            glovo_url: '',
            wolt_url: '',
            bolt_url: '',
            telegram_group_id: '',
            is_active: true,
            is_competitor: false,
            working_hours: {
                monday: { open: '10:00', close: '23:00' },
                tuesday: { open: '10:00', close: '23:00' },
                wednesday: { open: '10:00', close: '23:00' },
                thursday: { open: '10:00', close: '23:00' },
                friday: { open: '10:00', close: '23:00' },
                saturday: { open: '10:00', close: '23:00' },
                sunday: { open: '10:00', close: '23:00' }
            }
        })
    }

    // Filter, sort, paginate
    const filtered = restaurants
        .filter(r => {
            const matchesBrand = selectedBrand === 'all' || r.brand_id === selectedBrand
            const matchesSearch = !searchQuery ||
                r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.brands?.name?.toLowerCase().includes(searchQuery.toLowerCase())
            return matchesBrand && matchesSearch
        })
        .sort((a, b) => {
            let cmp = 0
            if (sortBy === 'name') cmp = (a.name || '').localeCompare(b.name || '')
            else if (sortBy === 'city') cmp = (a.city || '').localeCompare(b.city || '')
            else if (sortBy === 'status') cmp = (a.is_active ? 0 : 1) - (b.is_active ? 0 : 1)
            return sortDir === 'asc' ? cmp : -cmp
        })

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
    const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

    const handleSort = (field) => {
        if (sortBy === field) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
        else { setSortBy(field); setSortDir('asc') }
    }
    const sortIcon = (field) => sortBy === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

    if (loading) {
        return (
            <div style={{ padding: '24px 32px' }}>
                <div style={{ marginBottom: '24px' }}>
                    <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, color: colors.text }}>Restaurants</h1>
                    <p style={{ fontSize: '13px', color: colors.textSecondary, marginTop: '4px' }}>Loading...</p>
                </div>
                <TableSkeleton rows={5} columns={5} />
            </div>
        )
    }

    return (
        <div style={{ padding: '24px 32px', }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, color: colors.text, letterSpacing: '-0.5px' }}>
                        Restaurants
                    </h1>
                    <p style={{ fontSize: '13px', color: colors.textSecondary, marginTop: '4px' }}>
                        Manage monitored restaurants and platform URLs
                        {lastUpdated && <span style={{ marginLeft: '12px', fontSize: '11px', opacity: 0.7 }}>Last updated: {lastUpdated.toLocaleTimeString('ro-RO')}</span>}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {/* Brand filter */}
                    <select
                        value={selectedBrand}
                        onChange={(e) => { setSelectedBrand(e.target.value); setCurrentPage(1) }}
                        style={{
                            padding: '8px 14px',
                            background: colors.bg,
                            color: colors.text,
                            border: `0.5px solid ${colors.border}`,
                            borderRadius: '8px',
                            fontSize: '13px',
                            outline: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="all">Toate brandurile ({restaurants.length})</option>
                        {brands.map(b => (
                            <option key={b.id} value={b.id}>
                                {b.name} ({restaurants.filter(r => r.brand_id === b.id).length})
                            </option>
                        ))}
                    </select>
                    <input
                        type="text"
                        placeholder="Search restaurants..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
                        style={{
                            padding: '8px 14px',
                            background: colors.bg,
                            color: colors.text,
                            border: `0.5px solid ${colors.border}`,
                            borderRadius: '8px',
                            fontSize: '13px',
                            width: '200px',
                            outline: 'none'
                        }}
                    />
                    <button
                        onClick={openAddModal}
                        style={{
                            padding: '10px 20px',
                            background: colors.blue,
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'opacity 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                        onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                    >
                        + Add Restaurant
                    </button>
                </div>
            </div>

            {/* Restaurants Table */}
            <div style={{
                background: colors.card,
                backdropFilter: 'blur(20px)',
                border: `0.5px solid ${colors.border}`,
                borderRadius: '12px',
                overflow: 'hidden'
            }}>
                {restaurants.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg></div>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: colors.text, marginBottom: '8px' }}>
                            No restaurants yet
                        </div>
                        <div style={{ fontSize: '13px', color: colors.textSecondary }}>
                            Add your first restaurant to start monitoring
                        </div>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: `${colors.bg}80`, borderBottom: `0.5px solid ${colors.border}` }}>
                            <tr>
                                <th style={{
                                    padding: '12px 20px',
                                    textAlign: 'left',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    color: colors.textSecondary,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.6px',
                                    cursor: 'pointer'
                                }} onClick={() => handleSort('name')}>
                                    Restaurant{sortIcon('name')}
                                </th>
                                <th style={{
                                    padding: '12px 20px',
                                    textAlign: 'left',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    color: colors.textSecondary,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.6px',
                                    cursor: 'pointer'
                                }} onClick={() => handleSort('city')}>
                                    City{sortIcon('city')}
                                </th>
                                <th style={{
                                    padding: '12px 20px',
                                    textAlign: 'left',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    color: colors.textSecondary,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.6px'
                                }}>
                                    Platforms
                                </th>
                                <th style={{
                                    padding: '12px 20px',
                                    textAlign: 'left',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    color: colors.textSecondary,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.6px'
                                }}>
                                    Status
                                </th>
                                <th style={{
                                    padding: '12px 20px',
                                    textAlign: 'right',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    color: colors.textSecondary,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.6px'
                                }}>
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginated.map((restaurant, index) => (
                                <tr key={restaurant.id} style={{
                                    borderBottom: index < paginated.length - 1 ? `0.5px solid ${colors.border}` : 'none',
                                    transition: 'background 0.12s ease-out'
                                }}
                                    onMouseOver={(e) => e.currentTarget.style.background = colors.hover}
                                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: '500', color: colors.text }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                                width: '28px', height: '28px', borderRadius: '6px',
                                                background: restaurant.brands?.logo_url ? 'white' : colors.blue + '20',
                                                border: `0.5px solid ${colors.border}`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '11px', fontWeight: '700', color: colors.blue, flexShrink: 0,
                                                overflow: 'hidden', padding: restaurant.brands?.logo_url ? '2px' : 0,
                                            }}>
                                                {restaurant.brands?.logo_url ? (
                                                    <img src={restaurant.brands.logo_url} alt=""
                                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                        onError={e => { e.currentTarget.style.display = 'none' }}
                                                    />
                                                ) : (
                                                    restaurant.brands?.name?.charAt(0) || '?'
                                                )}
                                            </div>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {restaurant.name}
                                                    {restaurant.is_competitor && (
                                                        <span style={{ padding: '2px 6px', background: `${colors.red}20`, color: colors.red, fontSize: '10px', fontWeight: '700', borderRadius: '4px', textTransform: 'uppercase' }}>
                                                            Concurent
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '2px' }}>
                                                    {restaurant.brands?.name || ''}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '14px 20px', fontSize: '13px', color: colors.textSecondary }}>
                                        {restaurant.city || '-'}
                                    </td>
                                    <td style={{ padding: '14px 20px' }}>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            {restaurant.glovo_url && (
                                                <span style={{
                                                    padding: '4px 10px',
                                                    background: `${colors.orange}20`,
                                                    color: colors.orange,
                                                    fontSize: '11px',
                                                    fontWeight: '600',
                                                    borderRadius: '6px',
                                                    border: `0.5px solid ${colors.orange}40`
                                                }}>
                                                    Glovo
                                                </span>
                                            )}
                                            {restaurant.wolt_url && (
                                                <span style={{
                                                    padding: '4px 10px',
                                                    background: `${colors.blue}20`,
                                                    color: colors.blue,
                                                    fontSize: '11px',
                                                    fontWeight: '600',
                                                    borderRadius: '6px',
                                                    border: `0.5px solid ${colors.blue}40`
                                                }}>
                                                    Wolt
                                                </span>
                                            )}
                                            {restaurant.bolt_url && (
                                                <span style={{
                                                    padding: '4px 10px',
                                                    background: `${colors.green}20`,
                                                    color: colors.green,
                                                    fontSize: '11px',
                                                    fontWeight: '600',
                                                    borderRadius: '6px',
                                                    border: `0.5px solid ${colors.green}40`
                                                }}>
                                                    Bolt
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '14px 20px' }}>
                                        <span style={{
                                            padding: '4px 10px',
                                            background: restaurant.is_active ? `${colors.green}20` : `${colors.textSecondary}20`,
                                            color: restaurant.is_active ? colors.green : colors.textSecondary,
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            borderRadius: '6px',
                                            border: `0.5px solid ${restaurant.is_active ? colors.green : colors.textSecondary}40`
                                        }}>
                                            {restaurant.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                            <button
                                                onClick={() => openEditModal(restaurant)}
                                                style={{
                                                    padding: '6px 12px',
                                                    background: colors.blue,
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    fontWeight: '500',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(restaurant)}
                                                style={{
                                                    padding: '6px 12px',
                                                    background: colors.red,
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    fontWeight: '500',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    gap: '8px', marginTop: '16px', marginBottom: '8px'
                }}>
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        style={{
                            padding: '6px 12px', background: colors.card, color: colors.text,
                            border: `0.5px solid ${colors.border}`, borderRadius: '6px', fontSize: '12px',
                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                            opacity: currentPage === 1 ? 0.5 : 1
                        }}
                    >← Prev</button>
                    <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                        Page {currentPage} of {totalPages} ({filtered.length} total)
                    </span>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        style={{
                            padding: '6px 12px', background: colors.card, color: colors.text,
                            border: `0.5px solid ${colors.border}`, borderRadius: '6px', fontSize: '12px',
                            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                            opacity: currentPage === totalPages ? 0.5 : 1
                        }}
                    >Next →</button>
                </div>
            )}
            {showModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: colors.card,
                        border: `0.5px solid ${colors.border}`,
                        borderRadius: '12px',
                        padding: '24px',
                        maxWidth: '600px',
                        width: '90%',
                        maxHeight: '90vh',
                        overflow: 'auto'
                    }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '600', margin: 0, color: colors.text, marginBottom: '20px' }}>
                            {editingRestaurant ? 'Edit Restaurant' : 'Add Restaurant'}
                        </h2>

                        <form onSubmit={handleSubmit}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: colors.text, marginBottom: '6px' }}>
                                        Restaurant Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
                                            background: colors.bg,
                                            border: `0.5px solid ${colors.border}`,
                                            borderRadius: '8px',
                                            fontSize: '13px',
                                            color: colors.text,
                                            outline: 'none'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: colors.text, marginBottom: '6px' }}>
                                        City *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
                                            background: colors.bg,
                                            border: `0.5px solid ${colors.border}`,
                                            borderRadius: '8px',
                                            fontSize: '13px',
                                            color: colors.text,
                                            outline: 'none'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: colors.text, marginBottom: '6px' }}>
                                        Address
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
                                            background: colors.bg,
                                            border: `0.5px solid ${colors.border}`,
                                            borderRadius: '8px',
                                            fontSize: '13px',
                                            color: colors.text,
                                            outline: 'none'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: colors.text, marginBottom: '6px' }}>
                                        Glovo URL
                                    </label>
                                    <input
                                        type="url"
                                        value={formData.glovo_url}
                                        onChange={(e) => setFormData({ ...formData, glovo_url: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
                                            background: colors.bg,
                                            border: `0.5px solid ${colors.border}`,
                                            borderRadius: '8px',
                                            fontSize: '13px',
                                            color: colors.text,
                                            outline: 'none'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: colors.text, marginBottom: '6px' }}>
                                        Wolt URL
                                    </label>
                                    <input
                                        type="url"
                                        value={formData.wolt_url}
                                        onChange={(e) => setFormData({ ...formData, wolt_url: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
                                            background: colors.bg,
                                            border: `0.5px solid ${colors.border}`,
                                            borderRadius: '8px',
                                            fontSize: '13px',
                                            color: colors.text,
                                            outline: 'none'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: colors.text, marginBottom: '6px' }}>
                                        Bolt Food URL
                                    </label>
                                    <input
                                        type="url"
                                        value={formData.bolt_url}
                                        onChange={(e) => setFormData({ ...formData, bolt_url: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
                                            background: colors.bg,
                                            border: `0.5px solid ${colors.border}`,
                                            borderRadius: '8px',
                                            fontSize: '13px',
                                            color: colors.text,
                                            outline: 'none'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: colors.text, marginBottom: '6px' }}>
                                        Telegram Group ID
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.telegram_group_id}
                                        onChange={(e) => setFormData({ ...formData, telegram_group_id: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
                                            background: colors.bg,
                                            border: `0.5px solid ${colors.border}`,
                                            borderRadius: '8px',
                                            fontSize: '13px',
                                            color: colors.text,
                                            outline: 'none'
                                        }}
                                    />
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.is_active}
                                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                            style={{ width: '16px', height: '16px' }}
                                        />
                                        <label style={{ fontSize: '13px', fontWeight: '500', color: colors.text }}>
                                            Active monitoring
                                        </label>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.is_competitor}
                                            onChange={(e) => setFormData({ ...formData, is_competitor: e.target.checked })}
                                            style={{ width: '16px', height: '16px' }}
                                        />
                                        <label style={{ fontSize: '13px', fontWeight: '700', color: colors.red }}>
                                            Acesta este un Concurent
                                        </label>
                                    </div>
                                </div>

                                {/* ── Working Hours Schedule ── */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: colors.text, marginBottom: '10px' }}>
                                        Program de lucru
                                    </label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {[
                                            { key: 'monday', label: 'Luni' },
                                            { key: 'tuesday', label: 'Marți' },
                                            { key: 'wednesday', label: 'Miercuri' },
                                            { key: 'thursday', label: 'Joi' },
                                            { key: 'friday', label: 'Vineri' },
                                            { key: 'saturday', label: 'Sâmbătă' },
                                            { key: 'sunday', label: 'Duminică' },
                                        ].map(day => {
                                            const dayData = formData.working_hours?.[day.key] || {}
                                            const isClosed = dayData.closed === true
                                            return (
                                                <div key={day.key} style={{
                                                    display: 'flex', alignItems: 'center', gap: '8px',
                                                    padding: '6px 10px', borderRadius: '8px',
                                                    background: isClosed ? (colors.bg) : 'transparent',
                                                    opacity: isClosed ? 0.5 : 1,
                                                }}>
                                                    <span style={{ width: '72px', fontSize: '12px', fontWeight: '600', color: colors.text }}>{day.label}</span>
                                                    <input
                                                        type="time"
                                                        value={dayData.open || '10:00'}
                                                        disabled={isClosed}
                                                        onChange={(e) => {
                                                            const wh = { ...formData.working_hours }
                                                            wh[day.key] = { ...wh[day.key], open: e.target.value }
                                                            setFormData({ ...formData, working_hours: wh })
                                                        }}
                                                        style={{
                                                            padding: '5px 8px', borderRadius: '6px', fontSize: '12px',
                                                            border: `1px solid ${colors.border}`, background: colors.bg,
                                                            color: colors.text, outline: 'none', width: '95px',
                                                        }}
                                                    />
                                                    <span style={{ fontSize: '11px', color: colors.textSecondary }}>—</span>
                                                    <input
                                                        type="time"
                                                        value={dayData.close || '23:00'}
                                                        disabled={isClosed}
                                                        onChange={(e) => {
                                                            const wh = { ...formData.working_hours }
                                                            wh[day.key] = { ...wh[day.key], close: e.target.value }
                                                            setFormData({ ...formData, working_hours: wh })
                                                        }}
                                                        style={{
                                                            padding: '5px 8px', borderRadius: '6px', fontSize: '12px',
                                                            border: `1px solid ${colors.border}`, background: colors.bg,
                                                            color: colors.text, outline: 'none', width: '95px',
                                                        }}
                                                    />
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px', cursor: 'pointer', fontSize: '11px', color: colors.textSecondary, whiteSpace: 'nowrap' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isClosed}
                                                            onChange={(e) => {
                                                                const wh = { ...formData.working_hours }
                                                                if (e.target.checked) {
                                                                    wh[day.key] = { closed: true }
                                                                } else {
                                                                    wh[day.key] = { open: '10:00', close: '23:00' }
                                                                }
                                                                setFormData({ ...formData, working_hours: wh })
                                                            }}
                                                            style={{ width: '13px', height: '13px', accentColor: '#6366F1' }}
                                                        />
                                                        Închis
                                                    </label>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false)
                                        setEditingRestaurant(null)
                                        resetForm()
                                    }}
                                    style={{
                                        padding: '10px 20px',
                                        background: colors.bg,
                                        color: colors.text,
                                        border: `0.5px solid ${colors.border}`,
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        padding: '10px 20px',
                                        background: colors.blue,
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {editingRestaurant ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Toast Container */}
            <Toaster />

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                onClose={() => setDeleteConfirm({ isOpen: false, restaurant: null })}
                onConfirm={confirmDelete}
                title="Delete Restaurant"
                message={`Are you sure you want to delete "${deleteConfirm.restaurant?.name}"? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
            />
        </div>
    )
}
