import type { ApiProfile } from '../types'

export const DEFAULT_IMAGES_MODEL = 'gpt-image-2.5-sunburst'

export function isGeminiImageProfile(profile: ApiProfile) {
  if (profile.studioGroupPlatform) return profile.studioGroupPlatform === 'gemini'
  const model = profile.model.trim().toLowerCase()
  return model.includes('gemini') && model.includes('image')
}

export function getImageGenerationModel(profile: ApiProfile) {
  return profile.provider === 'openai' && profile.apiMode === 'responses'
    ? profile.imageGenerationModel?.trim() ?? ''
    : profile.model
}

export function isGptImage25Model(model: string) {
  return model.trim().toLowerCase().includes('gpt-image-2.5')
}
