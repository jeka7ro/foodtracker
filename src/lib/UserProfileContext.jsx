import { createContext, useContext, useState, useEffect } from 'react'

const UserProfileContext = createContext()

export const UserProfileProvider = ({ children }) => {
    const [profile, setProfile] = useState(() => {
        try {
            const saved = localStorage.getItem('userProfile')
            return saved ? JSON.parse(saved) : { displayName: '', avatarUrl: '' }
        } catch { return { displayName: '', avatarUrl: '' } }
    })

    useEffect(() => {
        localStorage.setItem('userProfile', JSON.stringify(profile))
    }, [profile])

    const updateProfile = (updates) => setProfile(p => ({ ...p, ...updates }))

    // Upload avatar: convert file to base64 data URL
    const uploadAvatar = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            updateProfile({ avatarUrl: e.target.result })
            resolve(e.target.result)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
    })

    return (
        <UserProfileContext.Provider value={{ profile, updateProfile, uploadAvatar }}>
            {children}
        </UserProfileContext.Provider>
    )
}

export const useUserProfile = () => useContext(UserProfileContext)
