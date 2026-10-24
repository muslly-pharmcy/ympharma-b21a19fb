import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getDispenseScreening,
  overrideScreening,
  screenDispense,
  summarizeDispenseScreening,
} from '@/lib/clinical-screening.functions'

export const dispenseScreeningKey = (dispenseId: string) => ['clinical-screening', dispenseId] as const

export function useDispenseScreening(dispenseId: string) {
  return useQuery({
    queryKey: dispenseScreeningKey(dispenseId),
    queryFn: () => getDispenseScreening({ data: { dispenseId } }),
    enabled: Boolean(dispenseId),
    retry: 0,
  })
}

function useInvalidateScreening(dispenseId: string) {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: dispenseScreeningKey(dispenseId) })
    queryClient.invalidateQueries({ queryKey: ['dispense', dispenseId] })
  }
}

export function useScreenDispense(dispenseId: string) {
  const invalidate = useInvalidateScreening(dispenseId)
  return useMutation({
    mutationFn: () => screenDispense({ data: { dispenseId } }),
    onSuccess: invalidate,
  })
}

export function useOverrideScreening(dispenseId: string) {
  const invalidate = useInvalidateScreening(dispenseId)
  return useMutation({
    mutationFn: (input: { screeningId: string; reason: string }) =>
      overrideScreening({
        data: {
          dispenseId,
          screeningId: input.screeningId,
          reason: input.reason,
          acknowledge: true,
        },
      }),
    onSuccess: invalidate,
  })
}

export function useSummarizeScreening(dispenseId: string) {
  const invalidate = useInvalidateScreening(dispenseId)
  return useMutation({
    mutationFn: (screeningId: string) => summarizeDispenseScreening({ data: { screeningId } }),
    onSuccess: invalidate,
  })
}
