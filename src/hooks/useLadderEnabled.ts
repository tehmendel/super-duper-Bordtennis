import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useLadderEnabled() {
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'ladder_enabled')
      .maybeSingle()
      .then(({ data }) => {
        if (data) setEnabled(data.value === true)
      })
  }, [])

  return enabled
}
