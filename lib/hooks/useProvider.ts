'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// Hook that returns the current logged-in provider's ID.
// All provider page queries should use this to scope data.
export function useProviderId() {
  const [providerId, setProviderId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from('providers').select('id').eq('user_id', user.id).maybeSingle()
      setProviderId(data?.id || null)
      setLoading(false)
    }
    load()
  }, [])

  return { providerId, loading }
}

// Hook for workers — returns their carer ID and selected provider ID.
// Workers may belong to multiple providers; the selected one is stored in localStorage.
export function useWorkerContext() {
  const [carerId, setCarerId] = useState<string | null>(null)
  const [providerId, setProviderId] = useState<string | null>(null)
  const [providers, setProviders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: carer } = await supabase
        .from('carers').select('id').eq('user_id', user.id).maybeSingle()
      if (!carer) { setLoading(false); return }
      setCarerId(carer.id)

      // Get all providers this worker is linked to
      const { data: links } = await supabase
        .from('provider_carers')
        .select('provider_id, providers(id, name)')
        .eq('carer_id', carer.id)
        .eq('active', true)

      const provs = (links || [])
        .map((l: any) => l.providers)
        .filter(Boolean)
      setProviders(provs)

      // Check localStorage for selected provider
      const stored = typeof window !== 'undefined'
        ? localStorage.getItem('caretime_worker_provider')
        : null
      if (stored && provs.some((p: any) => p.id === stored)) {
        setProviderId(stored)
      } else if (provs.length === 1) {
        setProviderId(provs[0].id)
      }
      // If multiple and none selected, providerId stays null — login page handles selection

      setLoading(false)
    }
    load()
  }, [])

  function selectProvider(id: string) {
    setProviderId(id)
    if (typeof window !== 'undefined') {
      localStorage.setItem('caretime_worker_provider', id)
    }
  }

  return { carerId, providerId, providers, loading, selectProvider }
}
