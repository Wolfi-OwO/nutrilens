import { useMutation } from '@tanstack/react-query'
import { uploadPhoto } from '@/lib/api-client'
import type { PhotoPredictionResponse } from '@/types/api'

export function usePhotoPrediction() {
  return useMutation({
    mutationFn: (file: File) => uploadPhoto<PhotoPredictionResponse>('/meal-logs/photo-prediction', file),
  })
}
