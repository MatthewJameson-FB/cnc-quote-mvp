import SeoLandingPage from '@/app/components/SeoLandingPage'

export const dynamic = 'force-static'

export default function Page() {
  return (
    <SeoLandingPage
      title="Replacement plastic parts in the UK"
      intro="Can’t find a replacement plastic part? Upload a photo and we’ll help recreate the trim, clip, cover or bracket that has snapped or gone missing."
      examples={[
        'A plastic interior clip snapped off and the trim no longer sits properly.',
        'A cover or trim piece is missing and the car or caravan looks unfinished.',
        'A handle, knob or bracket is unavailable from the manufacturer.',
      ]}
    />
  )
}
