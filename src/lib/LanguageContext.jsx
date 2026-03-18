import { createContext, useContext, useState, useEffect } from 'react'

const translations = {
    ro: {
        // Nav
        nav_dashboard: 'Dashboard',
        nav_monitoring: 'Monitoring',
        nav_stopControl: 'Stop Control',
        nav_marketing: 'Marketing',
        nav_competitors: 'Concurenți',
        nav_brands: 'Brands',
        nav_restaurants: 'Restaurants',
        nav_alerts: 'Alerts',
        nav_events: 'Events',
        nav_rules: 'Rules',
        nav_reports: 'Reports',
        nav_discovery: 'Discovery',
        nav_deliveryZone: 'Zone Livrare',
        nav_settings: 'Setări',

        // Theme
        theme_light: 'Light Mode',
        theme_dark: 'Dark Mode',

        // Auth
        logout: 'Deconectare',
        login: 'Autentificare',
        email: 'Email',
        password: 'Parolă',

        // Common
        search: 'Caută',
        save: 'Salvează',
        cancel: 'Anulează',
        add: 'Adaugă',
        edit: 'Editează',
        delete: 'Șterge',
        loading: 'Se încarcă...',
        all: 'Toate',
        today: 'Azi',
        export_excel: 'Export Excel',
        filters: 'Filtre',
        results: 'rezultate',
        page: 'Pagina',
        per_page: 'Per pag',
        back: 'Înapoi',
        close: 'Închide',
        confirm: 'Confirmi?',
        yes: 'Da',
        no: 'Nu',

        // Marketing
        marketing_title: 'Intelligence Competitiv',
        marketing_subtitle: 'Monitorizare automată concurență · Prețuri · Produse · Evoluție',
        tab_config: 'Configurații',
        tab_results: 'Rezultate',
        tab_history: 'Istoric',
        view_chronological: 'Cronologic',
        view_by_brand: 'Pe brand',
        view_by_city: 'Pe Oraș',
        view_by_product: 'Produs',
        run_all: 'Rulează Toate',
        add_search: 'Adaugă Căutare',
        rank_history: 'Istoric poziții',
        products_prices: 'Produse și prețuri',
        checks: 'Verificări',
        appearances: 'Apariții',
        best_rank: 'Best Rank',
        rating: 'Rating',
        locations: 'Locații',
        products: 'Produse',
        cities: 'Locații',
        platforms: 'Platforme',
        brands_count: 'Branduri',
        back_to_history: 'Înapoi la Istoric',
        back_to_cities: 'Înapoi la Orașe',
        open_on_platform: 'Deschide pe platformă',
        filter_brand: 'Filtrare brand…',
        filter_city: 'Filtrare oraș…',

        // Delivery Zone
        dz_title: 'Zone Livrare',
        dz_subtitle: 'Multiple adrese per restaurant · verificare 1-5 km · istoric zilnic',
        tab_configs: '⚙ Configurații',
        tab_history_dz: '📋 Istoric',
        import_restaurants: '⬇ Import Restaurante',
        run_all_dz: 'Rulează Toate',
        add_restaurant: 'Adaugă Restaurant',
        no_restaurants: 'Niciun restaurant configurat',
        verify: 'Verifică',
        verifying: 'Se verifică...',
        no_history: 'Niciun istoric',
        run_check_hint: 'Rulează o verificare din tab-ul Configurații',
        address: 'Adresă',
        add_address: '+ Adaugă adresă',
        geocode: '📍 Geo',
        config_name: 'NUME CONFIGURAȚIE',
        restaurant_name: 'RESTAURANT (al nostru)',
        brand_searched: 'BRAND CĂUTAT',
        platform: 'PLATFORMĂ',
        city: 'ORAȘ',

        // Settings
        settings_title: 'Setări',
        settings_profile: 'Profil',
        settings_avatar: 'Avatar',
        settings_display_name: 'Nume afișat',
        settings_language: 'Limbă',
        settings_theme: 'Temă',
        settings_save: 'Salvează setările',
        settings_saved: 'Salvat!',
        upload_avatar: 'Încarcă avatar',
        remove_avatar: 'Elimină',

        // Competitors
        competitors_title: 'Concurenți',

        // Dashboard
        dashboard_title: 'Dashboard',
        total_restaurants: 'Restaurante active',
        active_monitoring: 'Monitorizare activă',
        alerts_today: 'Alerte astăzi',
        revenue_at_risk: 'Venituri la risc',
    },
    en: {
        // Nav
        nav_dashboard: 'Dashboard',
        nav_monitoring: 'Monitoring',
        nav_stopControl: 'Stop Control',
        nav_marketing: 'Marketing',
        nav_competitors: 'Competitors',
        nav_brands: 'Brands',
        nav_restaurants: 'Restaurants',
        nav_alerts: 'Alerts',
        nav_events: 'Events',
        nav_rules: 'Rules',
        nav_reports: 'Reports',
        nav_discovery: 'Discovery',
        nav_deliveryZone: 'Delivery Zones',
        nav_settings: 'Settings',

        // Theme
        theme_light: 'Light Mode',
        theme_dark: 'Dark Mode',

        // Auth
        logout: 'Log Out',
        login: 'Sign In',
        email: 'Email',
        password: 'Password',

        // Common
        search: 'Search',
        save: 'Save',
        cancel: 'Cancel',
        add: 'Add',
        edit: 'Edit',
        delete: 'Delete',
        loading: 'Loading...',
        all: 'All',
        today: 'Today',
        export_excel: 'Export Excel',
        filters: 'Filters',
        results: 'results',
        page: 'Page',
        per_page: 'Per page',
        back: 'Back',
        close: 'Close',
        confirm: 'Confirm?',
        yes: 'Yes',
        no: 'No',

        // Marketing
        marketing_title: 'Competitive Intelligence',
        marketing_subtitle: 'Automated competitor monitoring · Prices · Products · Evolution',
        tab_config: 'Configuration',
        tab_results: 'Results',
        tab_history: 'History',
        view_chronological: 'Chronological',
        view_by_brand: 'By Brand',
        view_by_city: 'By City',
        view_by_product: 'Product',
        run_all: 'Run All',
        add_search: 'Add Search',
        rank_history: 'Position History',
        products_prices: 'Products & Prices',
        checks: 'Checks',
        appearances: 'Appearances',
        best_rank: 'Best Rank',
        rating: 'Rating',
        locations: 'Locations',
        products: 'Products',
        cities: 'Locations',
        platforms: 'Platforms',
        brands_count: 'Brands',
        back_to_history: 'Back to History',
        back_to_cities: 'Back to Cities',
        open_on_platform: 'Open on platform',
        filter_brand: 'Filter brand…',
        filter_city: 'Filter city…',

        // Delivery Zone
        dz_title: 'Delivery Zones',
        dz_subtitle: 'Multiple addresses per restaurant · check 1-5 km · daily history',
        tab_configs: '⚙ Configurations',
        tab_history_dz: '📋 History',
        import_restaurants: '⬇ Import Restaurants',
        run_all_dz: 'Run All',
        add_restaurant: 'Add Restaurant',
        no_restaurants: 'No restaurants configured',
        verify: 'Check',
        verifying: 'Checking...',
        no_history: 'No history',
        run_check_hint: 'Run a check from the Configurations tab',
        address: 'Address',
        add_address: '+ Add address',
        geocode: '📍 Geo',
        config_name: 'CONFIG NAME',
        restaurant_name: 'RESTAURANT (ours)',
        brand_searched: 'BRAND SEARCHED',
        platform: 'PLATFORM',
        city: 'CITY',

        // Settings
        settings_title: 'Settings',
        settings_profile: 'Profile',
        settings_avatar: 'Avatar',
        settings_display_name: 'Display Name',
        settings_language: 'Language',
        settings_theme: 'Theme',
        settings_save: 'Save Settings',
        settings_saved: 'Saved!',
        upload_avatar: 'Upload avatar',
        remove_avatar: 'Remove',

        // Competitors
        competitors_title: 'Competitors',

        // Dashboard
        dashboard_title: 'Dashboard',
        total_restaurants: 'Active restaurants',
        active_monitoring: 'Active monitoring',
        alerts_today: 'Alerts today',
        revenue_at_risk: 'Revenue at risk',
    }
}

const LanguageContext = createContext()

export const LanguageProvider = ({ children }) => {
    const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'ro')

    useEffect(() => {
        localStorage.setItem('lang', lang)
    }, [lang])

    const t = (key) => translations[lang]?.[key] || translations['ro']?.[key] || key

    return (
        <LanguageContext.Provider value={{ lang, setLang, t, translations }}>
            {children}
        </LanguageContext.Provider>
    )
}

export const useLanguage = () => useContext(LanguageContext)
